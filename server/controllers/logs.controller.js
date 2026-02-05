import pool from "../db/mysql.js";

export async function getLogs(req, res) {
    try {
        const [rows] = await pool.execute(`
            SELECT 
                ua.id,
                ua.activityType,
                ua.details,
                ua.createdAt,
                u_actor.email as actorEmail,
                u_actor.alias as actorAlias,
                u_target.email as targetEmail,
                u_target.alias as targetAlias
            FROM UserActivity ua
            LEFT JOIN User u_actor ON ua.userId = u_actor.id
            LEFT JOIN User u_target ON JSON_UNQUOTE(JSON_EXTRACT(ua.details, '$.targetUserId')) = u_target.id
            ORDER BY ua.createdAt DESC
            LIMIT 1000
        `);
        res.json({ ok: true, logs: rows });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, error: "An internal server error occurred." });
    }
}
