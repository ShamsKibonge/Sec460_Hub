import pool from "../db/mysql.js";

export async function getAllChats(req, res) {
    try {
        const [groups] = await pool.execute(
            'SELECT `id`, `name`, "group" as type FROM `Group`'
        );

        const [directs] = await pool.execute(`
            SELECT d.id, CONCAT(u1.alias, ', ', u2.alias) as name, "direct" as type
            FROM DirectThread d
            JOIN User u1 ON d.userAId = u1.id
            JOIN User u2 ON d.userBId = u2.id
        `);

        res.json({ ok: true, chats: [...groups, ...directs] });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, error: "An internal server error occurred." });
    }
}

export async function getChatMessages(req, res) {
    const { type, id } = req.params;

    if (!type || !id) {
        return res.status(400).json({ ok: false, error: "type and id are required." });
    }

    try {
        let messages;
        const query = `
            SELECT m.*, u.alias as senderAlias, u.email as senderEmail 
            FROM Message m
            JOIN User u ON m.senderId = u.id
        `;

        if (type === "group") {
            const [rows] = await pool.execute(
                `${query} WHERE m.groupId = ? ORDER BY m.createdAt ASC`,
                [id]
            );
            messages = rows;
        } else if (type === "direct") {
            const [rows] = await pool.execute(
                `${query} WHERE m.threadId = ? ORDER BY m.createdAt ASC`,
                [id]
            );
            messages = rows;
        } else {
            return res.status(400).json({ ok: false, error: "Invalid chat type." });
        }

        res.json({ ok: true, messages });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, error: "An internal server error occurred." });
    }
}
