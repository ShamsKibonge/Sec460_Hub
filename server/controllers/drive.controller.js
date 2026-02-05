import pool from "../db/mysql.js";
import cuid from "cuid";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { safeJoin } from "../utils/safePath.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");


async function ensureFolderOwner(folderId, userId) {
    const [rows] = await pool.execute('SELECT `id`, `ownerId` FROM `Folder` WHERE `id` = ?', [folderId]);
    const folder = rows[0];
    if (!folder) return null;
    if (folder.ownerId !== userId) return null;
    return folder;
}

// POST /api/v1/drive/folders
export async function createFolder(req, res) {
    const { userId } = req.user;

    const name = String(req.body?.name || "").trim();
    const parentId = req.body?.parentId ? String(req.body.parentId) : null;

    if (!name) return res.status(400).json({ ok: false, error: "Folder name is required." });

    if (parentId) {
        const parent = await ensureFolderOwner(parentId, userId);
        if (!parent) return res.status(403).json({ ok: false, error: "Invalid parent folder." });
    }

    try {
        const newId = cuid();
        await pool.execute(
            'INSERT INTO `Folder` (`id`, `name`, `ownerId`, `parentId`, `createdAt`, `updatedAt`) VALUES (?, ?, ?, ?, NOW(), NOW())',
            [newId, name, userId, parentId]
        );

        const [rows] = await pool.execute(
            'SELECT `id`, `name`, `parentId`, `createdAt` FROM `Folder` WHERE `id` = ?',
            [newId]
        );
        const folder = rows[0];

        return res.json({ ok: true, folder });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ ok: false, error: "Folder already exists here." });
        }
        console.error(e);
        return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
}

async function buildFolderPath(folderId, userId) {
    if (!folderId) return []; // root

    const path = [];
    let currentId = folderId;

    for (let i = 0; i < 50; i++) { // protect against infinite loops
        const [rows] = await pool.execute(
            'SELECT `id`, `name`, `parentId`, `ownerId` FROM `Folder` WHERE `id` = ?',
            [currentId]
        );
        const folder = rows[0];

        if (!folder) break;
        if (folder.ownerId !== userId) break; // safety

        path.push({ id: folder.id, name: folder.name });
        currentId = folder.parentId;

        if (!currentId) break;
    }

    return path.reverse(); // root -> current
}


// GET /api/v1/drive/contents?folderId=
export async function getContents(req, res) {
    const { userId } = req.user;
    const folderId = req.query?.folderId ? String(req.query.folderId) : null;
    const q = String(req.query.q || "").trim();

    // If folderId provided, ensure it belongs to this user
    if (folderId) {
        const folder = await ensureFolderOwner(folderId, userId);
        if (!folder) {
            return res.status(403).json({ ok: false, error: "Not allowed." });
        }
    }

    let folderQuery = 'SELECT `id`, `name`, `parentId`, `createdAt` FROM `Folder` WHERE `ownerId` = ? AND ' + (folderId ? '`parentId` = ?' : '`parentId` IS NULL');
    const folderParams = [userId];
    if (folderId) folderParams.push(folderId);

    if (q) {
        folderQuery += ' AND `name` LIKE ?';
        folderParams.push(`%${q}%`);
    }
    folderQuery += ' ORDER BY `name` ASC';
    const [folders] = await pool.execute(folderQuery, folderParams);

    let fileQuery = 'SELECT `id`, `originalName`, `mimeType`, `size`, `createdAt`, `folderId` FROM `File` WHERE `uploaderId` = ? AND ' + (folderId ? '`folderId` = ?' : '`folderId` IS NULL');
    const fileParams = [userId];
    if (folderId) fileParams.push(folderId);

    if (q) {
        fileQuery += ' AND `originalName` LIKE ?';
        fileParams.push(`%${q}%`);
    }
    fileQuery += ' ORDER BY `createdAt` DESC';
    const [files] = await pool.execute(fileQuery, fileParams);


    const path = await buildFolderPath(folderId, userId);

    return res.json({ ok: true, folderId, path, folders, files });
}

// POST /api/v1/drive/files  (multipart/form-data field name: "file")
export async function uploadDriveFile(req, res) {
    const { userId } = req.user;

    const folderId = req.body?.folderId ? String(req.body.folderId) : null;

    if (folderId) {
        const allowed = await ensureFolderOwner(folderId, userId);
        if (!allowed) return res.status(403).json({ ok: false, error: "Invalid folder." });
    }

    if (!req.file) return res.status(400).json({ ok: false, error: "No file uploaded." });

    const newId = cuid();
    await pool.execute(
        'INSERT INTO `File` (`id`, `originalName`, `mimeType`, `size`, `storageName`, `uploaderId`, `folderId`, `createdAt`, `updatedAt`) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
        [newId, req.file.originalname, req.file.mimetype, req.file.size, req.file.filename, userId, folderId]
    );
    const [rows] = await pool.execute(
        'SELECT `id`, `originalName`, `mimeType`, `size`, `createdAt`, `folderId` FROM `File` WHERE `id` = ?',
        [newId]
    );

    res.json({ ok: true, file: rows[0] });
}

// GET /api/v1/drive/files/:fileId/download
export async function downloadDriveFile(req, res) {
    const { userId } = req.user;
    const fileId = String(req.params.fileId);

    const [rows] = await pool.execute(
        'SELECT `id`, `originalName`, `storageName`, `uploaderId`, `folderId` FROM `File` WHERE `id` = ?',
        [fileId]
    );
    const f = rows[0];

    if (!f) return res.status(404).json({ ok: false, error: "File not found." });

    if (f.uploaderId !== userId) {
        return res.status(403).json({ ok: false, error: "Not allowed." });
    }

    const fullPath = safeJoin(UPLOAD_DIR, f.storageName);

    try {
        await fs.access(fullPath);
        res.download(fullPath, f.originalName);
    } catch {
        return res.status(404).json({ ok: false, error: "File missing on disk." });
    }
}

export async function deleteFile(req, res) {
    const { userId } = req.user;
    const { fileId } = req.params;

    const [rows] = await pool.execute(
        'SELECT `id`, `uploaderId`, `storageName`, `originalName` FROM `File` WHERE `id` = ?',
        [fileId]
    );
    const file = rows[0];

    if (!file) return res.status(404).json({ ok: false, error: "File not found." });

    if (file.uploaderId !== userId) {
        return res.status(403).json({ ok: false, error: "Not allowed to delete this file." });
    }

    await pool.execute('DELETE FROM `File` WHERE `id` = ?', [fileId]);

    try {
        await fs.unlink(safeJoin(UPLOAD_DIR, file.storageName));
    } catch {
        // ignore if already missing
    }

    res.json({ ok: true });
}

export async function renameFile(req, res) {
    const { userId } = req.user;
    const { fileId } = req.params;
    const name = String(req.body?.name || "").trim();

    if (!name) return res.status(400).json({ ok: false, error: "Name is required." });

    const [fileRows] = await pool.execute('SELECT `id`, `uploaderId` FROM `File` WHERE `id` = ?', [fileId]);
    const file = fileRows[0];

    if (!file) return res.status(404).json({ ok: false, error: "File not found." });

    if (file.uploaderId !== userId) {
        return res.status(403).json({ ok: false, error: "Not allowed to rename this file." });
    }

    await pool.execute('UPDATE `File` SET `originalName` = ?, `updatedAt` = NOW() WHERE `id` = ?', [name, fileId]);

    const [updatedRows] = await pool.execute(
        'SELECT `id`, `originalName`, `mimeType`, `size`, `createdAt`, `folderId` FROM `File` WHERE `id` = ?',
        [fileId]
    );

    res.json({ ok: true, file: updatedRows[0] });
}

export async function deleteFolder(req, res) {
    const { userId } = req.user;
    const { folderId } = req.params;

    const [folderRows] = await pool.execute('SELECT `id`, `name`, `ownerId` FROM `Folder` WHERE `id` = ?', [folderId]);
    const folder = folderRows[0];

    if (!folder) return res.status(404).json({ ok: false, error: "Folder not found." });

    if (folder.ownerId !== userId) {
        return res.status(403).json({ ok: false, error: "Not allowed to delete this folder." });
    }

    const [childFolderRows] = await pool.execute('SELECT COUNT(*) as count FROM `Folder` WHERE `parentId` = ?', [folderId]);
    const childFoldersCount = childFolderRows[0].count;

    const [childFileRows] = await pool.execute('SELECT COUNT(*) as count FROM `File` WHERE `folderId` = ?', [folderId]);
    const childFilesCount = childFileRows[0].count;

    if (childFoldersCount > 0 || childFilesCount > 0) {
        return res.status(400).json({
            ok: false,
            error: "Folder is not empty. Delete/move its contents first.",
        });
    }

    await pool.execute('DELETE FROM `Folder` WHERE `id` = ?', [folderId]);

    res.json({ ok: true });
}

export async function renameFolder(req, res) {
    const { userId } = req.user;
    const { folderId } = req.params;
    const name = String(req.body?.name || "").trim();

    if (!name) return res.status(400).json({ ok: false, error: "Name is required." });

    const [folderRows] = await pool.execute('SELECT `id`, `ownerId` FROM `Folder` WHERE `id` = ?', [folderId]);
    const folder = folderRows[0];

    if (!folder) return res.status(404).json({ ok: false, error: "Folder not found." });

    if (folder.ownerId !== userId) {
        return res.status(403).json({ ok: false, error: "Not allowed to rename this folder." });
    }

    await pool.execute('UPDATE `Folder` SET `name` = ?, `updatedAt` = NOW() WHERE `id` = ?', [name, folderId]);
    const [updatedRows] = await pool.execute(
        'SELECT `id`, `name`, `parentId`, `createdAt` FROM `Folder` WHERE `id` = ?',
        [folderId]
    );

    res.json({ ok: true, folder: updatedRows[0] });
}

export async function searchMyFiles(req, res) {
    const { userId } = req.user;
    const q = String(req.query.q || "").trim();
    const take = Math.min(parseInt(req.query.take || "50", 10) || 50, 100);

    const [files] = await pool.execute(
        'SELECT `id`, `originalName`, `mimeType`, `size`, `createdAt`, `folderId` FROM `File` WHERE `uploaderId` = ? AND `originalName` LIKE ? ORDER BY `createdAt` DESC LIMIT ?',
        [userId, `%${q}%`, take]
    );

    res.json({ ok: true, files });
}
