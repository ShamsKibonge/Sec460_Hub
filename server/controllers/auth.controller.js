import { otpStore } from "../auth/otp.store.js";
import { signToken } from "../auth/jwt.js";
import pool from "../db/mysql.js";
import cuid from "cuid";
import { logActivity } from "../services/activity.service.js";
import jwt from "jsonwebtoken";

import {
    generate6DigitCode,
    hashCode,
    normalizeEmail,
    verifyCode,
} from "../auth/otp.utils.js";
import { sendLoginCodeEmail } from "../services/email.service.js";

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 30;

// ===== DAST RATE LIMITING (in-memory) =====
const dastAttempts = new Map();
const DAST_RATE_LIMIT = 5; // max requests per minute
const DAST_WINDOW_MS = 60000; // 1 minute

function checkDastRateLimit(ip) {
    const now = Date.now();
    if (!dastAttempts.has(ip)) {
        dastAttempts.set(ip, []);
    }

    const attempts = dastAttempts.get(ip);
    // Remove attempts older than 1 minute
    const recentAttempts = attempts.filter(t => now - t < DAST_WINDOW_MS);

    if (recentAttempts.length >= DAST_RATE_LIMIT) {
        return false; // rate limited
    }

    recentAttempts.push(now);
    dastAttempts.set(ip, recentAttempts);
    return true;
}

export async function requestCode(req, res) {
    const email = normalizeEmail(req.body?.email);

    if (!email || !email.includes("@")) {
        return res.status(400).json({ ok: false, error: "Valid email is required." });
    }

    // ===== DAST-ONLY PASSWORD PATH =====
    if (process.env.DAST_ENABLED === "true" && email === process.env.DAST_EMAIL) {
        // Rate limit DAST attempts
        const clientIp = req.ip || req.connection.remoteAddress;
        if (!checkDastRateLimit(clientIp)) {
            await logActivity(null, "DAST_AUTH_RATE_LIMITED", { email, ip: clientIp });
            return res.status(429).json({
                ok: false,
                error: "Rate limited. Max 5 requests per minute."
            });
        }

        // Verify X-DAST-KEY header
        const dastKey = req.header("x-dast-key");
        if (!dastKey || dastKey !== process.env.DAST_KEY) {
            await logActivity(null, "DAST_AUTH_INVALID_KEY", { email, ip: clientIp });
            return res.status(401).json({ ok: false, error: "Unauthorized" });
        }

        // Verify password in request body
        const password = req.body?.password;
        if (!password || password !== process.env.DAST_PASSWORD) {
            await logActivity(null, "DAST_AUTH_INVALID_PASSWORD", { email, ip: clientIp });
            return res.status(401).json({ ok: false, error: "Invalid credentials" });
        }

        // Create DAST user payload (minimal privileges)
        const user = {
            id: "dast-bot",
            email,
            role: "dast",
            isAdmin: false,
            isSuperAdmin: false,
            isActive: true,
        };

        try {
            const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "30m" });
            await logActivity(null, "DAST_AUTH_SUCCESS", { email });

            return res.json({
                ok: true,
                token,
                user: { id: user.id, email: user.email, role: user.role },
                needsOnboarding: false,
                dast: true,
            });
        } catch (err) {
            await logActivity(null, "DAST_AUTH_TOKEN_ERROR", { email, error: err.message });
            return res.status(500).json({ ok: false, error: "Token generation failed" });
        }
    }

    // ===== NORMAL OTP FLOW FOR REGULAR USERS =====

    const existing = otpStore.get(email);
    const now = Date.now();

    if (existing?.lastSentAt && now - existing.lastSentAt < RESEND_COOLDOWN_SECONDS * 1000) {
        return res.status(429).json({
            ok: false,
            error: `Please wait ${RESEND_COOLDOWN_SECONDS}s before requesting another code.`,
        });
    }

    const code = generate6DigitCode();
    const codeHash = await hashCode(code);

    otpStore.set(email, {
        codeHash,
        expiresAt: now + CODE_TTL_MINUTES * 60 * 1000,
        attemptsLeft: MAX_ATTEMPTS,
        lastSentAt: now,
    });

    await logActivity(null, "AUTH_CODE_REQUESTED", { email });

    // send email
    await sendLoginCodeEmail({ to: email, code });

    return res.json({ ok: true, message: "Code sent." });
}

export async function verifyCodeAndLogin(req, res) {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || "").trim();

    if (!email || !code) {
        return res.status(400).json({ ok: false, error: "Email and code are required." });
    }

    const record = otpStore.get(email);
    if (!record) {
        return res.status(400).json({ ok: false, error: "No code requested for this email." });
    }

    if (Date.now() > record.expiresAt) {
        otpStore.delete(email);
        return res.status(400).json({ ok: false, error: "Code expired. Request a new one." });
    }

    if (record.attemptsLeft <= 0) {
        otpStore.delete(email);
        return res.status(429).json({ ok: false, error: "Too many attempts. Request a new code." });
    }

    const ok = await verifyCode(code, record.codeHash);
    if (!ok) {
        record.attemptsLeft -= 1;
        otpStore.set(email, record);
        await logActivity(null, "AUTH_CODE_INCORRECT", { email });
        return res.status(401).json({ ok: false, error: "Invalid code." });
    }

    // Success — in Phase 4.2 we’ll issue a JWT and create/find user in DB.
    otpStore.delete(email);

    // 1) Find or create user
    let user;
    const [rows] = await pool.execute('SELECT * FROM `User` WHERE `email` = ?', [email]);
    user = rows[0];


    if (!user) {
        const newId = cuid();
        const newUser = {
            id: newId,
            email: email,
            alias: null,
            isAdmin: false, // default to false
            isSuperAdmin: false, // default to false
            isActive: true, // default to true
        };
        await pool.execute(
            'INSERT INTO `User` (`id`, `email`, `alias`, `createdAt`, `updatedAt`, `isActive`) VALUES (?, ?, ?, NOW(), NOW(), ?)',
            [newUser.id, newUser.email, newUser.alias, newUser.isActive]
        );
        user = newUser;
    }

    if (!user.isActive) {
        await logActivity(user.id, "AUTH_LOGIN_FAILURE", { reason: "Account deactivated" });
        return res.status(403).json({ ok: false, error: "Account deactivated" });
    }

    await logActivity(user.id, "AUTH_LOGIN_SUCCESS");

    // 2) Token
    const token = signToken({ userId: user.id, email: user.email, isAdmin: user.isAdmin, isSuperAdmin: user.isSuperAdmin, isActive: user.isActive });

    // 3) Onboarding flag (needs alias)
    const needsOnboarding = !user.alias;

    return res.json({
        ok: true,
        message: "Login successful ✅",
        token,
        user: { id: user.id, email: user.email, alias: user.alias, isAdmin: user.isAdmin, isSuperAdmin: user.isSuperAdmin, isActive: user.isActive },
        needsOnboarding,
    });
}

export async function logout(req, res) {
    const { userId } = req.user;
    await logActivity(userId, "AUTH_LOGOUT");
    res.json({ ok: true, message: "Logout successful" });
}
