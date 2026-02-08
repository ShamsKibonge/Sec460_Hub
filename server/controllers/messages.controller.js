import pool from "../db/mysql.js";
import cuid from "cuid";
import { getIO } from "../socket.js";
import { markGroupSeen, markThreadSeen } from "../services/lastSeen.service.js";
import { createMailer } from "../services/email.service.js";

async function emitInboxUpdateForThread(threadId) {
    const io = getIO();
    const [rows] = await pool.execute('SELECT `userAId`, `userBId` FROM `DirectThread` WHERE `id` = ?', [threadId]);
    const t = rows[0];
    if (!t) return;
    io.to(`user:${t.userAId}`).emit("inbox:update");
    io.to(`user:${t.userBId}`).emit("inbox:update");
}

async function emitInboxUpdateForGroup(groupId) {
    const io = getIO();
    const [members] = await pool.execute('SELECT `userId` FROM `GroupMember` WHERE `groupId` = ?', [groupId]);
    for (const m of members) {
        io.to(`user:${m.userId}`).emit("inbox:update");
    }
}

async function requireGroupMember(groupId, userId) {
    const [rows] = await pool.execute('SELECT `groupId` FROM `GroupMember` WHERE `groupId` = ? AND `userId` = ?', [groupId, userId]);
    return rows.length > 0;
}

async function requireThreadMember(threadId, userId) {
    const [rows] = await pool.execute('SELECT `userAId`, `userBId` FROM `DirectThread` WHERE `id` = ?', [threadId]);
    const t = rows[0];
    if (!t) return false;
    return t.userAId === userId || t.userBId === userId;
}

// helpers
function makeIn(list) {
    // returns: { clause: "IN (?, ?, ?)", params: [...] } OR { clause: "IN (NULL)", params: [] }
    if (!Array.isArray(list) || list.length === 0) return { clause: "IN (NULL)", params: [] };
    return { clause: `IN (${list.map(() => "?").join(",")})`, params: list };
}

export async function getInbox(req, res) {
    const { userId } = req.user;

    const [groupRows] = await pool.execute(
        `
      SELECT g.id, g.name
      FROM \`GroupMember\` gm
      JOIN \`Group\` g ON gm.groupId = g.id
      WHERE gm.userId = ?
    `,
        [userId]
    );
    const groupIds = groupRows.map((r) => r.id);

    const [threads] = await pool.execute(
        `
      SELECT t.id,
             ua.id as userAId, ua.email as userAEmail, ua.alias as userAAlias,
             ub.id as userBId, ub.email as userBEmail, ub.alias as userBAlias
      FROM \`DirectThread\` t
      JOIN \`User\` ua ON t.userAId = ua.id
      JOIN \`User\` ub ON t.userBId = ub.id
      WHERE t.userAId = ? OR t.userBId = ?
    `,
        [userId, userId]
    );
    const threadIds = threads.map((t) => t.id);

    // helper: IN (?,?,?) builder
    const inPlaceholders = (arr) => arr.map(() => "?").join(",");

    // ----- LAST MESSAGES -----
    let lastMessages = [];

    if (groupIds.length || threadIds.length) {
        const groupClause = groupIds.length
            ? `(m.groupId IN (${inPlaceholders(groupIds)}) AND m.threadId IS NULL)`
            : null;

        const threadClause = threadIds.length
            ? `(m.threadId IN (${inPlaceholders(threadIds)}) AND m.groupId IS NULL)`
            : null;

        const whereParts = [groupClause, threadClause].filter(Boolean);
        const whereSql = whereParts.length ? whereParts.join(" OR ") : "1=0";

        const lastMessagesQuery = `
      WITH ranked_messages AS (
        SELECT
          m.*,
          ROW_NUMBER() OVER(
            PARTITION BY COALESCE(m.groupId, m.threadId)
            ORDER BY m.createdAt DESC
          ) AS rn
        FROM \`Message\` m
        WHERE ${whereSql}
      )
      SELECT
        rm.groupId, rm.threadId, rm.kind, rm.text, rm.createdAt,
        f.originalName
      FROM ranked_messages rm
      LEFT JOIN \`File\` f ON rm.fileId = f.id
      WHERE rm.rn = 1
    `;

        const params = [...groupIds, ...threadIds];
        const [rows] = await pool.execute(lastMessagesQuery, params);
        lastMessages = rows;
    }

    const lastGroupMap = new Map(
        lastMessages.filter((m) => m.groupId).map((m) => [m.groupId, m])
    );
    const lastThreadMap = new Map(
        lastMessages.filter((m) => m.threadId).map((m) => [m.threadId, m])
    );

    // ----- SEEN ROWS -----
    let seenRows = [];
    if (groupIds.length || threadIds.length) {
        const seenGroupClause = groupIds.length
            ? `groupId IN (${inPlaceholders(groupIds)})`
            : null;

        const seenThreadClause = threadIds.length
            ? `threadId IN (${inPlaceholders(threadIds)})`
            : null;

        const seenWhere = [seenGroupClause, seenThreadClause].filter(Boolean).join(" OR ");

        const [rows] = await pool.execute(
            `
        SELECT \`groupId\`, \`threadId\`, \`lastSeenAt\`
        FROM \`ChatLastSeen\`
        WHERE \`userId\` = ?
          AND (${seenWhere})
      `,
            [userId, ...groupIds, ...threadIds]
        );
        seenRows = rows;
    }

    const seenGroup = new Map(
        seenRows.filter((r) => r.groupId).map((r) => [r.groupId, r.lastSeenAt])
    );
    const seenThread = new Map(
        seenRows.filter((r) => r.threadId).map((r) => [r.threadId, r.lastSeenAt])
    );

    async function unreadForGroup(groupId) {
        const lastSeenAt = seenGroup.get(groupId) || new Date(0);
        const [rows] = await pool.execute(
            `
        SELECT COUNT(*) as count
        FROM \`Message\`
        WHERE \`groupId\` = ?
          AND \`threadId\` IS NULL
          AND \`createdAt\` > ?
          AND \`senderId\` != ?
      `,
            [groupId, lastSeenAt, userId]
        );
        return rows[0].count;
    }

    async function unreadForThread(threadId) {
        const lastSeenAt = seenThread.get(threadId) || new Date(0);
        const [rows] = await pool.execute(
            `
        SELECT COUNT(*) as count
        FROM \`Message\`
        WHERE \`threadId\` = ?
          AND \`groupId\` IS NULL
          AND \`createdAt\` > ?
          AND \`senderId\` != ?
      `,
            [threadId, lastSeenAt, userId]
        );
        return rows[0].count;
    }

    const groupItems = await Promise.all(
        groupRows.map(async (g) => {
            const last = lastGroupMap.get(g.id) || null;
            const unread = await unreadForGroup(g.id);
            const preview =
                last?.kind === "file"
                    ? `📎 ${last?.originalName || "File"}`
                    : (last?.text || "");
            return {
                type: "group",
                id: g.id,
                name: g.name,
                lastMessageText: preview,
                lastMessageAt: last?.createdAt || null,
                unreadCount: unread,
            };
        })
    );

    const directItems = await Promise.all(
        threads.map(async (t) => {
            const otherUser =
                t.userAId === userId
                    ? { id: t.userBId, email: t.userBEmail, alias: t.userBAlias }
                    : { id: t.userAId, email: t.userAEmail, alias: t.userAAlias };

            const last = lastThreadMap.get(t.id) || null;
            const unread = await unreadForThread(t.id);
            const preview =
                last?.kind === "file"
                    ? `📎 ${last?.originalName || "File"}`
                    : (last?.text || "");

            return {
                type: "direct",
                id: t.id,
                name: otherUser.alias || otherUser.email,
                otherUser,
                lastMessageText: preview,
                lastMessageAt: last?.createdAt || null,
                unreadCount: unread,
            };
        })
    );

    const all = [...groupItems, ...directItems].sort((a, b) => {
        const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return tb - ta;
    });

    res.json({ ok: true, items: all });
}


export async function getGroupMessages(req, res) {
    const { userId } = req.user;
    const { groupId } = req.params;

    const allowed = await requireGroupMember(groupId, userId);
    if (!allowed) return res.status(403).json({ ok: false, error: "Not a group member." });

    const [messages] = await pool.execute(`
        SELECT
            m.id, m.kind, m.text, m.createdAt,
            u.id as senderId, u.email as senderEmail, u.alias as senderAlias,
            f.id as fileId, f.originalName, f.size, f.mimeType
        FROM \`Message\` m
        JOIN \`User\` u ON m.senderId = u.id
        LEFT JOIN \`File\` f ON m.fileId = f.id
        WHERE m.groupId = ?
        ORDER BY m.createdAt ASC
    `, [groupId]);

    await markGroupSeen(userId, groupId);

    res.json({
        ok: true, messages: messages.map(m => ({
            id: m.id, kind: m.kind, text: m.text, createdAt: m.createdAt,
            sender: { id: m.senderId, email: m.senderEmail, alias: m.senderAlias },
            file: m.fileId ? { id: m.fileId, originalName: m.originalName, size: m.size, mimeType: m.mimeType } : null
        }))
    });
}

export async function postGroupMessage(req, res) {
    const { userId } = req.user;
    const { groupId } = req.params;
    const text = String(req.body?.text || "").trim();

    if (!text) return res.status(400).json({ ok: false, error: "Message text is required." });

    const allowed = await requireGroupMember(groupId, userId);
    if (!allowed) return res.status(403).json({ ok: false, error: "Not a group member." });

    const messageId = cuid();
    await pool.execute(
        'INSERT INTO `Message` (`id`, `senderId`, `groupId`, `text`, `kind`, `createdAt`) VALUES (?, ?, ?, ?, ?, NOW())',
        [messageId, userId, groupId, text, 'text']
    );

    const [msgRows] = await pool.execute(`
        SELECT m.id, m.kind, m.text, m.createdAt,
               u.id as senderId, u.email as senderEmail, u.alias as senderAlias
        FROM \`Message\` m
        JOIN \`User\` u ON m.senderId = u.id
        WHERE m.id = ?
    `, [messageId]);

    const msgData = msgRows[0];
    const msg = {
        id: msgData.id, kind: msgData.kind, text: msgData.text, createdAt: msgData.createdAt,
        sender: { id: msgData.senderId, email: msgData.senderEmail, alias: msgData.senderAlias },
        file: null
    };

    const io = getIO();
    io.to(`group:${groupId}`).emit("message:new", { scope: "group", groupId, message: msg });
    await emitInboxUpdateForGroup(groupId);

    // schedule unread reminder emails for group members
    try { scheduleUnreadReminder('group', groupId, msg, msg.sender.id); } catch (e) { console.error(e); }

    res.json({ ok: true, message: msg });
}

export async function sendDirectMessage(req, res) {
    const { userId } = req.user;
    const toEmail = String(req.body?.toEmail || "").trim().toLowerCase();
    const text = String(req.body?.text || "").trim();

    if (!toEmail.includes("@")) return res.status(400).json({ ok: false, error: "Valid toEmail is required." });
    if (!text) return res.status(400).json({ ok: false, error: "Message text is required." });

    const allowedDomain = (process.env.ALLOWED_DOMAIN || "").toLowerCase();
    const domain = toEmail.split("@")[1] || "";
    if (allowedDomain && domain.toLowerCase() !== allowedDomain) {
        return res.status(403).json({ ok: false, error: "Email domain not allowed." });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let [otherRows] = await connection.execute('SELECT * FROM `User` WHERE `email` = ?', [toEmail]);
        let other = otherRows[0];

        if (!other) {
            const newId = cuid();
            await connection.execute('INSERT INTO `User` (id, email, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())', [newId, toEmail]);
            other = { id: newId, email: toEmail, alias: null };
        }

        const a = userId < other.id ? userId : other.id;
        const b = userId < other.id ? other.id : userId;

        let [threadRows] = await connection.execute('SELECT * FROM `DirectThread` WHERE `userAId` = ? AND `userBId` = ?', [a, b]);
        let thread = threadRows[0];

        if (!thread) {
            const threadId = cuid();
            await connection.execute('INSERT INTO `DirectThread` (id, userAId, userBId, createdAt) VALUES (?, ?, ?, NOW())', [threadId, a, b]);
            thread = { id: threadId };
        }

        const messageId = cuid();
        await connection.execute(
            'INSERT INTO `Message` (id, senderId, threadId, text, kind, createdAt) VALUES (?, ?, ?, ?, ?, NOW())',
            [messageId, userId, thread.id, text, 'text']
        );

        const [msgRows] = await connection.execute(`
            SELECT m.id, m.kind, m.text, m.createdAt,
                   u.id as senderId, u.email as senderEmail, u.alias as senderAlias
            FROM \`Message\` m JOIN \`User\` u ON m.senderId = u.id
            WHERE m.id = ?
        `, [messageId]);

        const msgData = msgRows[0];
        const msg = {
            id: msgData.id, kind: msgData.kind, text: msgData.text, createdAt: msgData.createdAt,
            sender: { id: msgData.senderId, email: msgData.senderEmail, alias: msgData.senderAlias },
            file: null
        };

        await connection.commit();

        const io = getIO();
        io.to(`thread:${thread.id}`).emit("message:new", { scope: "direct", threadId: thread.id, message: msg });
        await emitInboxUpdateForThread(thread.id);

        // schedule unread reminder for the direct recipient
        try { scheduleUnreadReminder('direct', thread.id, msg, msg.sender.id); } catch (e) { console.error(e); }

        res.json({ ok: true, threadId: thread.id, message: msg });

    } catch (e) {
        await connection.rollback();
        console.error(e);
        res.status(500).json({ ok: false, error: 'Internal server error' });
    } finally {
        connection.release();
    }
}

export async function getDirectMessages(req, res) {
    const { userId } = req.user;
    const { threadId } = req.params;

    const allowed = await requireThreadMember(threadId, userId);
    if (!allowed) return res.status(403).json({ ok: false, error: "Not allowed." });

    const [messages] = await pool.execute(`
        SELECT
            m.id, m.kind, m.text, m.createdAt,
            u.id as senderId, u.email as senderEmail, u.alias as senderAlias,
            f.id as fileId, f.originalName, f.size, f.mimeType
        FROM \`Message\` m
        JOIN \`User\` u ON m.senderId = u.id
        LEFT JOIN \`File\` f ON m.fileId = f.id
        WHERE m.threadId = ?
        ORDER BY m.createdAt ASC
    `, [threadId]);

    await markThreadSeen(userId, threadId);

    res.json({
        ok: true, messages: messages.map(m => ({
            id: m.id, kind: m.kind, text: m.text, createdAt: m.createdAt,
            sender: { id: m.senderId, email: m.senderEmail, alias: m.senderAlias },
            file: m.fileId ? { id: m.fileId, originalName: m.originalName, size: m.size, mimeType: m.mimeType } : null
        }))
    });
}

export async function markChatSeen(req, res) {
    const { userId } = req.user;
    const { scope, chatId } = req.body;

    if (!scope || !chatId) return res.status(400).json({ ok: false, error: "scope and chatId are required." });

    const now = new Date();
    if (scope === "group") {
        const allowed = await requireGroupMember(chatId, userId);
        if (!allowed) return res.status(403).json({ ok: false, error: "Not a group member." });

        await pool.execute(
            'INSERT INTO `ChatLastSeen` (id, userId, groupId, lastSeenAt, updatedAt) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE lastSeenAt = VALUES(lastSeenAt), updatedAt = VALUES(updatedAt)',
            [cuid(), userId, chatId, now, now]
        );
        return res.json({ ok: true });
    }

    if (scope === "direct") {
        const allowed = await requireThreadMember(chatId, userId);
        if (!allowed) return res.status(403).json({ ok: false, error: "Not allowed." });

        await pool.execute(
            'INSERT INTO `ChatLastSeen` (id, userId, threadId, lastSeenAt, updatedAt) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE lastSeenAt = VALUES(lastSeenAt), updatedAt = VALUES(updatedAt)',
            [cuid(), userId, chatId, now, now]
        );
        return res.json({ ok: true });
    }

    return res.status(400).json({ ok: false, error: "Invalid scope." });
}

export async function attachFileToGroup(req, res) {
    const { userId } = req.user;
    const { groupId } = req.params;
    const fileId = String(req.body?.fileId || "").trim();

    if (!fileId) return res.status(400).json({ ok: false, error: "fileId is required." });

    const allowed = await requireGroupMember(groupId, userId);
    if (!allowed) return res.status(403).json({ ok: false, error: "Not a group member." });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        await connection.execute(
            'INSERT INTO `FileShare` (id, fileId, groupId, createdAt) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE fileId = fileId',
            [cuid(), fileId, groupId]
        );

        const messageId = cuid();
        await connection.execute(
            'INSERT INTO `Message` (id, kind, fileId, senderId, groupId, createdAt) VALUES (?, ?, ?, ?, ?, NOW())',
            [messageId, 'file', fileId, userId, groupId]
        );

        const [msgRows] = await connection.execute(`
            SELECT
                m.id, m.kind, m.createdAt,
                u.id as senderId, u.email as senderEmail, u.alias as senderAlias,
                f.id as fileId, f.originalName, f.mimeType, f.size
            FROM Message m
            JOIN User u ON m.senderId = u.id
            JOIN File f ON m.fileId = f.id
            WHERE m.id = ?
        `, [messageId]);

        await connection.commit();

        const msgData = msgRows[0];
        const msg = {
            id: msgData.id, kind: msgData.kind, createdAt: msgData.createdAt,
            sender: { id: msgData.senderId, email: msgData.senderEmail, alias: msgData.senderAlias },
            file: { id: msgData.fileId, originalName: msgData.originalName, mimeType: msgData.mimeType, size: msgData.size },
        };

        const io = getIO();
        io.to(`group:${groupId}`).emit("message:new", { scope: "group", groupId, message: msg });
        await emitInboxUpdateForGroup(groupId);

        // schedule unread reminder emails for group members
        try { scheduleUnreadReminder('group', groupId, msg, msg.sender.id); } catch (e) { console.error(e); }

        res.json({ ok: true, message: msg });
    } catch (e) {
        await connection.rollback();
        console.error(e);
        res.status(500).json({ ok: false, error: 'Internal server error' });
    } finally {
        connection.release();
    }
}

export async function attachFileToThread(req, res) {
    const { userId } = req.user;
    const { threadId } = req.params;
    const fileId = String(req.body?.fileId || "").trim();

    if (!fileId) return res.status(400).json({ ok: false, error: "fileId is required." });

    const allowed = await requireThreadMember(threadId, userId);
    if (!allowed) return res.status(403).json({ ok: false, error: "Not allowed." });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        await connection.execute(
            'INSERT INTO `FileShare` (id, fileId, threadId, createdAt) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE fileId = fileId',
            [cuid(), fileId, threadId]
        );

        const messageId = cuid();
        await connection.execute(
            'INSERT INTO `Message` (id, kind, fileId, senderId, threadId, createdAt) VALUES (?, ?, ?, ?, ?, NOW())',
            [messageId, 'file', fileId, userId, threadId]
        );

        const [msgRows] = await connection.execute(`
            SELECT
                m.id, m.kind, m.createdAt,
                u.id as senderId, u.email as senderEmail, u.alias as senderAlias,
                f.id as fileId, f.originalName, f.mimeType, f.size
            FROM Message m
            JOIN User u ON m.senderId = u.id
            JOIN File f ON m.fileId = f.id
            WHERE m.id = ?
        `, [messageId]);

        await connection.commit();

        const msgData = msgRows[0];
        const msg = {
            id: msgData.id, kind: msgData.kind, createdAt: msgData.createdAt,
            sender: { id: msgData.senderId, email: msgData.senderEmail, alias: msgData.senderAlias },
            file: { id: msgData.fileId, originalName: msgData.originalName, mimeType: msgData.mimeType, size: msgData.size },
        };

        const io = getIO();
        io.to(`thread:${threadId}`).emit("message:new", { scope: "direct", threadId, message: msg });
        await emitInboxUpdateForThread(threadId);

        // schedule unread reminder for thread recipient (file message)
        try { scheduleUnreadReminder('direct', threadId, msg, msg.sender.id); } catch (e) { console.error(e); }

        res.json({ ok: true, message: msg });
    } catch (e) {
        await connection.rollback();
        console.error(e);
        res.status(500).json({ ok: false, error: 'Internal server error' });
    } finally {
        connection.release();
    }
}

// Schedule a reminder email 10 minutes after a message is created.
// If the recipient hasn't seen the message by then, send a reminder email.
function scheduleUnreadReminder(scope, id, message, senderId) {
    // run after 1 minute (60000 ms) for testing — change to 10 minutes in production
    setTimeout(async () => {
        try {
            const createdAt = message.createdAt;
            const transporter = createMailer();

            if (scope === "group") {
                // get group members (exclude sender)
                const [members] = await pool.execute('SELECT `userId` FROM `GroupMember` WHERE `groupId` = ?', [id]);
                for (const m of members) {
                    if (m.userId === senderId) continue;

                    // check last seen
                    const [seenRows] = await pool.execute('SELECT `lastSeenAt` FROM `ChatLastSeen` WHERE `userId` = ? AND `groupId` = ?', [m.userId, id]);
                    const lastSeenAt = (seenRows[0] && seenRows[0].lastSeenAt) ? new Date(seenRows[0].lastSeenAt) : new Date(0);
                    if (new Date(createdAt) <= lastSeenAt) continue; // already seen

                    // fetch user email
                    const [users] = await pool.execute('SELECT `email` FROM `User` WHERE `id` = ?', [m.userId]);
                    const to = users[0]?.email;
                    if (!to) continue;

                    // construct links
                    const portal = process.env.PORTAL_URL || `http://sec460.sofkam.com`;
                    const apiBase = process.env.API_BASE_URL || portal.replace(/\/$/, '');
                    const chatLink = `${portal}/messages?groupId=${encodeURIComponent(id)}`;
                    const fileLink = message.file?.id ? `${apiBase}/api/v1/files/${message.file.id}/download` : null;

                    const html = `
                        <p>Hi,</p>
                        <p>You have unread messages in a group.</p>
                        <p><b>From:</b> ${message.sender?.alias || message.sender?.email || 'Someone'}</p>
                        <p><b>Message:</b> ${message.text ? escapeHtml(message.text) : (message.file ? 'File attached' : '')}</p>
                        <p><a href="${chatLink}">Open the conversation</a></p>
                        ${fileLink ? `<p><a href="${fileLink}">Download attached file</a></p>` : ''}
                        <p>If you don't want these reminders, adjust your notification settings in the portal.</p>
                    `;

                    await transporter.sendMail({
                        from: process.env.EMAIL_USER,
                        to,
                        subject: `Unread messages in group`,
                        html,
                    });
                }
            } else if (scope === "direct") {
                // get thread members
                const [rows] = await pool.execute('SELECT `userAId`, `userBId` FROM `DirectThread` WHERE `id` = ?', [id]);
                const t = rows[0];
                if (!t) return;

                const otherId = t.userAId === senderId ? t.userBId : t.userAId;
                if (!otherId) return;

                // check last seen for thread
                const [seenRows] = await pool.execute('SELECT `lastSeenAt` FROM `ChatLastSeen` WHERE `userId` = ? AND `threadId` = ?', [otherId, id]);
                const lastSeenAt = (seenRows[0] && seenRows[0].lastSeenAt) ? new Date(seenRows[0].lastSeenAt) : new Date(0);
                if (new Date(createdAt) <= lastSeenAt) return; // already seen

                const [users] = await pool.execute('SELECT `email` FROM `User` WHERE `id` = ?', [otherId]);
                const to = users[0]?.email;
                if (!to) return;

                const portal = process.env.PORTAL_URL || `https://sec460.sofkam.com`;
                const apiBase = process.env.API_BASE_URL || portal.replace(/\/$/, '');
                const chatLink = `${portal}/messages?threadId=${encodeURIComponent(id)}`;
                const fileLink = message.file?.id ? `${apiBase}/api/v1/files/${message.file.id}/download` : null;

                const html = `
                    <p>Hi,</p>
                    <p>You have an unread message.</p>
                    <p><b>From:</b> ${message.sender?.alias || message.sender?.email || 'Someone'}</p>
                    <p><b>Message:</b> ${message.text ? escapeHtml(message.text) : (message.file ? 'File attached' : '')}</p>
                    <p><a href="${chatLink}">Open the conversation</a></p>
                    ${fileLink ? `<p><a href="${fileLink}">Download attached file</a></p>` : ''}
                `;

                await transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to,
                    subject: `Unread message`,
                    html,
                });
            }
        } catch (e) {
            console.error('Reminder email error', e);
        }
    }, 1 * 60 * 1000);
}

// simple HTML-escape helper for user message text to avoid breaking the email HTML
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}