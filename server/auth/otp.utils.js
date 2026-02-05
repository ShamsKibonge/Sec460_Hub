import crypto from "crypto";
import bcrypt from "bcryptjs";

export function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

export function isAllowedDomain(email) {
    // const allowed = (process.env.ALLOWED_DOMAIN || "").toLowerCase();
    // const domain = email.split("@")[1] || "";
    // return allowed && domain.toLowerCase() === allowed;
    return true; // Allow all domains
}

export function generate6DigitCode() { 
    // 000000 to 999999
    const n = crypto.randomInt(0, 1_000_000);
    return String(n).padStart(6, "0");
}

export async function hashCode(code) {
    return bcrypt.hash(code, 10);
}

export async function verifyCode(code, hash) {
    return bcrypt.compare(code, hash);
}
