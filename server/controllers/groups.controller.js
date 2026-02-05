import pool from "../db/mysql.js";
import cuid from "cuid";
import { logActivity } from "../services/activity.service.js";

export async function createGroup(req, res) {
    const { userId } = req.user;
    const name = String(req.body?.name || "").trim();

    if (!name || name.length < 2) {
        return res.status(400).json({ ok: false, error: "Group name is required (min 2 chars)." });
    }

    const groupId = cuid();
    const memberId = cuid();
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();
        await connection.execute(
            'INSERT INTO `Group` (`id`, `name`, `createdBy`, `createdAt`, `updatedAt`) VALUES (?, ?, ?, NOW(), NOW())',
            [groupId, name, userId]
        );
        await connection.execute(
            'INSERT INTO `GroupMember` (`id`, `groupId`, `userId`, `role`, `createdAt`) VALUES (?, ?, ?, ?, NOW())',
            [memberId, groupId, userId, 'admin']
        );
        await connection.commit();

        await logActivity(userId, "GROUP_CREATED", { groupId, groupName: name });

        const [rows] = await connection.execute('SELECT `id`, `name`, `createdAt` FROM `Group` WHERE `id` = ?', [groupId]);
        res.json({ ok: true, group: rows[0] });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ ok: false, error: 'Internal server error' });
    } finally {
        connection.release();
    }
}

export async function listMyGroups(req, res) {
    const { userId } = req.user;

    const [rows] = await pool.execute(`
        SELECT
            g.id,
            g.name,
            g.createdAt,
            gm.role as myRole
        FROM \`GroupMember\` gm
        JOIN \`Group\` g ON gm.groupId = g.id
        WHERE gm.userId = ?
        ORDER BY gm.createdAt DESC
    `, [userId]);

    res.json({ ok: true, groups: rows });
}

export async function listGroupMembers(req, res) {
    const { userId } = req.user;
    const groupId = req.params.groupId;

    const [membershipRows] = await pool.execute(
        'SELECT `groupId` FROM `GroupMember` WHERE `groupId` = ? AND `userId` = ?',
        [groupId, userId]
    );
    if (membershipRows.length === 0) {
        return res.status(403).json({ ok: false, error: "Not a group member." });
    }

    const [memberRows] = await pool.execute(`
        SELECT
            u.id,
            u.email,
            u.alias,
            gm.role
        FROM \`GroupMember\` gm
        JOIN \`User\` u ON gm.userId = u.id
        WHERE gm.groupId = ?
        ORDER BY gm.role ASC, gm.createdAt ASC
    `, [groupId]);

    res.json({ ok: true, members: memberRows });
}

export async function addMemberByEmail(req, res) {
    const { userId } = req.user;
    const groupId = req.params.groupId;
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email.includes("@")) {
        return res.status(400).json({ ok: false, error: "Valid email is required." });
    }

    const [meRows] = await pool.execute(
        'SELECT `role` FROM `GroupMember` WHERE `groupId` = ? AND `userId` = ?',
        [groupId, userId]
    );
    const me = meRows[0];
    if (!me) return res.status(403).json({ ok: false, error: "Not a group member." });
    if (me.role !== "admin") return res.status(403).json({ ok: false, error: "Admin only." });

    const allowed = (process.env.ALLOWED_DOMAIN || "").toLowerCase();
    const domain = email.split("@")[1] || "";
    if (allowed && domain.toLowerCase() !== allowed) {
        return res.status(403).json({ ok: false, error: "Email domain not allowed." });
    }
    
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let [userRows] = await connection.execute('SELECT * FROM `User` WHERE `email` = ?', [email]);
        let user = userRows[0];

        if (!user) {
            const newId = cuid();
            await connection.execute(
                'INSERT INTO `User` (`id`, `email`, `alias`, `createdAt`, `updatedAt`) VALUES (?, ?, ?, NOW(), NOW())',
                [newId, email, null]
            );
            user = { id: newId, email, alias: null };
        }

        const memberId = cuid();
        try {
            await connection.execute(
                'INSERT INTO `GroupMember` (`id`, `groupId`, `userId`, `role`, `createdAt`) VALUES (?, ?, ?, ?, NOW())',
                [memberId, groupId, user.id, 'member']
            );
        } catch (e) {
            if (e.code === 'ER_DUP_ENTRY') {
                await connection.rollback();
                return res.status(409).json({ ok: false, error: "User already in group." });
            }
            throw e;
        }
        
        await connection.commit();

        await logActivity(userId, "GROUP_MEMBER_ADDED", { groupId, targetUserId: user.id });

        res.json({ ok: true, message: "Member added.", user: { id: user.id, email: user.email, alias: user.alias } });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ ok: false, error: 'Internal server error' });
    } finally {
        connection.release();
    }
}
