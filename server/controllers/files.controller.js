import pool from "../db/mysql.js";
import cuid from "cuid";
import fs from "fs";
import path from "path";
import { getIO } from "../socket.js";

async function requireGroupMember(groupId, userId) {
    const [rows] = await pool.execute(
        'SELECT `groupId` FROM `GroupMember` WHERE `groupId` = ? AND `userId` = ?',
        [groupId, userId]
    );
    return rows.length > 0;
}

async function requireThreadMember(threadId, userId) {
    const [rows] = await pool.execute(
        'SELECT `userAId`, `userBId` FROM `DirectThread` WHERE `id` = ?',
        [threadId]
    );
    const t = rows[0];
    if (!t) return false;
    return t.userAId === userId || t.userBId === userId;
}

export async function uploadToGroup(req, res) {
    const { userId } = req.user;
    const { groupId } = req.params;
    const io = getIO();

    try {
        const allowed = await requireGroupMember(groupId, userId);
        if (!allowed) {
            return res.status(403).json({ ok: false, error: "Not a group member." });
        }

        if (!req.file) {
            return res.status(400).json({ ok: false, error: "No file uploaded." });
        }

        const fileId = cuid();
        const messageId = cuid();
        const shareId = cuid();

        // Using a transaction to ensure all or nothing
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        
        try {
            await connection.execute(
                'INSERT INTO `File` (`id`, `originalName`, `mimeType`, `size`, `storageName`, `uploaderId`, `createdAt`, `updatedAt`) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
                [fileId, req.file.originalname, req.file.mimetype, req.file.size, req.file.filename, userId]
            );
            await connection.execute(
                'INSERT INTO `FileShare` (`id`, `fileId`, `groupId`, `createdAt`) VALUES (?, ?, ?, NOW())',
                [shareId, fileId, groupId]
            );
            await connection.execute(
                'INSERT INTO `Message` (`id`, `kind`, `fileId`, `senderId`, `groupId`, `createdAt`) VALUES (?, ?, ?, ?, ?, NOW())',
                [messageId, 'file', fileId, userId, groupId]
            );

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }


        const [msgRows] = await pool.execute(
            `SELECT
                m.id, m.kind, m.createdAt,
                u.id as senderId, u.email as senderEmail, u.alias as senderAlias,
                f.id as fileId, f.originalName, f.mimeType, f.size
             FROM Message m
             JOIN User u ON m.senderId = u.id
             JOIN File f ON m.fileId = f.id
             WHERE m.id = ?`,
            [messageId]
        );
        const msgData = msgRows[0];
        const msg = {
            id: msgData.id,
            kind: msgData.kind,
            createdAt: msgData.createdAt,
            sender: { id: msgData.senderId, email: msgData.senderEmail, alias: msgData.senderAlias },
            file: { id: msgData.fileId, originalName: msgData.originalName, mimeType: msgData.mimeType, size: msgData.size },
        };

        io.to(`group:${groupId}`).emit("message:new", { scope: "group", groupId, message: msg });
        res.json({ ok: true, message: msg });

    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, error: "Internal server error" });
    }
}


export async function uploadToThread(req, res) {
    const { userId } = req.user;
    const { threadId } = req.params;
    const io = getIO();

    try {
        const allowed = await requireThreadMember(threadId, userId);
        if (!allowed) {
            return res.status(403).json({ ok: false, error: "Not allowed." });
        }

        if (!req.file) {
            return res.status(400).json({ ok: false, error: "No file uploaded." });
        }

        const fileId = cuid();
        const messageId = cuid();
        const shareId = cuid();
        
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            await connection.execute(
                'INSERT INTO `File` (`id`, `originalName`, `mimeType`, `size`, `storageName`, `uploaderId`, `createdAt`, `updatedAt`) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
                [fileId, req.file.originalname, req.file.mimetype, req.file.size, req.file.filename, userId]
            );
            await connection.execute(
                'INSERT INTO `FileShare` (`id`, `fileId`, `threadId`, `createdAt`) VALUES (?, ?, ?, NOW())',
                [shareId, fileId, threadId]
            );
            await connection.execute(
                'INSERT INTO `Message` (`id`, `kind`, `fileId`, `senderId`, `threadId`, `createdAt`) VALUES (?, ?, ?, ?, ?, NOW())',
                [messageId, 'file', fileId, userId, threadId]
            );
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }


        const [msgRows] = await pool.execute(
            `SELECT
                m.id, m.kind, m.createdAt,
                u.id as senderId, u.email as senderEmail, u.alias as senderAlias,
                f.id as fileId, f.originalName, f.mimeType, f.size
             FROM Message m
             JOIN User u ON m.senderId = u.id
             JOIN File f ON m.fileId = f.id
             WHERE m.id = ?`,
            [messageId]
        );
        const msgData = msgRows[0];
        const msg = {
            id: msgData.id,
            kind: msgData.kind,
            createdAt: msgData.createdAt,
            sender: { id: msgData.senderId, email: msgData.senderEmail, alias: msgData.senderAlias },
            file: { id: msgData.fileId, originalName: msgData.originalName, mimeType: msgData.mimeType, size: msgData.size },
        };

        io.to(`thread:${threadId}`).emit("message:new", { scope: "direct", threadId, message: msg });
        res.json({ ok: true, message: msg });

    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, error: "Internal server error" });
    }
}

export async function listGroupFiles(req, res) {
    const { userId } = req.user;
    const { groupId } = req.params;

    const allowed = await requireGroupMember(groupId, userId);
    if (!allowed) return res.status(403).json({ ok: false, error: "Not a group member." });

    const [rows] = await pool.execute(
        `SELECT
            fs.createdAt as sharedAt,
            f.id, f.originalName, f.mimeType, f.size, f.createdAt,
            u.email as uploaderEmail, u.alias as uploaderAlias
        FROM FileShare fs
        JOIN File f ON fs.fileId = f.id
        JOIN User u ON f.uploaderId = u.id
        WHERE fs.groupId = ?
        ORDER BY fs.createdAt DESC`,
        [groupId]
    );

    const files = rows.map(row => ({
        id: row.id,
        originalName: row.originalName,
        mimeType: row.mimeType,
        size: row.size,
        createdAt: row.createdAt,
        sharedAt: row.sharedAt,
        uploader: {
            email: row.uploaderEmail,
            alias: row.uploaderAlias,
        }
    }));

    res.json({ ok: true, files });
}

export async function listThreadFiles(req, res) {
    const { userId } = req.user;
    const { threadId } = req.params;

    const allowed = await requireThreadMember(threadId, userId);
    if (!allowed) return res.status(403).json({ ok: false, error: "Not allowed." });

    const [rows] = await pool.execute(
        `SELECT
            fs.createdAt as sharedAt,
            f.id, f.originalName, f.mimeType, f.size, f.createdAt,
            u.email as uploaderEmail, u.alias as uploaderAlias
        FROM FileShare fs
        JOIN File f ON fs.fileId = f.id
        JOIN User u ON f.uploaderId = u.id
        WHERE fs.threadId = ?
        ORDER BY fs.createdAt DESC`,
        [threadId]
    );

    const files = rows.map(row => ({
        id: row.id,
        originalName: row.originalName,
        mimeType: row.mimeType,
        size: row.size,
        createdAt: row.createdAt,
        sharedAt: row.sharedAt,
        uploader: {
            email: row.uploaderEmail,
            alias: row.uploaderAlias,
        }
    }));

    res.json({ ok: true, files });
}

export async function downloadFile(req, res) {
    const { userId } = req.user;
    const { fileId } = req.params;

    const [shares] = await pool.execute('SELECT `groupId`, `threadId` FROM `FileShare` WHERE `fileId` = ?', [fileId]);

    if (shares.length === 0) return res.status(404).json({ ok: false, error: "File not found." });

    let allowed = false;
    for (const s of shares) {
        if (s.groupId) {
            const ok = await requireGroupMember(s.groupId, userId);
            if (ok) { allowed = true; break; }
        }
        if (s.threadId) {
            const ok = await requireThreadMember(s.threadId, userId);
            if (ok) { allowed = true; break; }
        }
    }

    if (!allowed) return res.status(403).json({ ok: false, error: "Not allowed." });

    const [fileRows] = await pool.execute('SELECT `storageName`, `originalName` FROM `File` WHERE `id` = ?', [fileId]);
    const file = fileRows[0];
    if (!file) return res.status(404).json({ ok: false, error: "File not found." });

    const fullPath = path.join(process.cwd(), "uploads", file.storageName);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ ok: false, error: "Missing on disk." });

    res.download(fullPath, file.originalName);
}
