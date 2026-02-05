import pool from "../db/mysql.js";

export async function getMe(req, res) {
    const { userId } = req.user || {};
    if (!userId) return res.status(401).json({ ok: false, error: "Missing userId in token" });

    const [rows] = await pool.execute(
        'SELECT `id`, `email`, `alias`, `createdAt` FROM `User` WHERE `id` = ?',
        [userId]
    );
    const user = rows[0];

    if (!user) return res.status(404).json({ ok: false, error: "User not found" });

    res.json({ ok: true, user });
}

export async function setMyAlias(req, res) {
    const { userId } = req.user;
    const alias = String(req.body?.alias || "").trim();

    if (!alias || alias.length < 3) {
        return res.status(400).json({ ok: false, error: "Alias must be at least 3 characters." });
    }

    // basic allowed characters: letters, numbers, underscore, dash
    if (!/^[a-zA-Z0-9_-]+$/.test(alias)) {
        return res.status(400).json({
            ok: false,
            error: "Alias can only use letters, numbers, _ or -",
        });
    }

    try {
        await pool.execute('UPDATE `User` SET `alias` = ?, `updatedAt` = NOW() WHERE `id` = ?', [alias, userId]);
        const [rows] = await pool.execute(
            'SELECT `id`, `email`, `alias` FROM `User` WHERE `id` = ?',
            [userId]
        );
        const updated = rows[0];

        res.json({ ok: true, user: updated });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ ok: false, error: "Alias already taken." });
        }
        // It's good practice to log the unexpected error
        console.error(e);
        return res.status(500).json({ ok: false, error: "An internal server error occurred." });
    }
}
