import pool from "../db/mysql.js";

export async function getDashboard(req, res, next) { // added next
    try {
        const { userId } = req.user;
        
        // Unread total
        const [groupRows] = await pool.execute('SELECT groupId FROM `GroupMember` WHERE userId = ?', [userId]);
        const groupIds = groupRows.map((r) => r.groupId);

        const [threads] = await pool.execute('SELECT id FROM `DirectThread` WHERE userAId = ? OR userBId = ?', [userId, userId]);
        const threadIds = threads.map((t) => t.id);

        let seenRows = [];
        if (groupIds.length > 0 || threadIds.length > 0) {
            const whereParts = [];
            const params = [userId];
            if (groupIds.length > 0) {
                whereParts.push(`groupId IN (${groupIds.map(() => '?').join(',')})`);
                params.push(...groupIds);
            }
            if (threadIds.length > 0) {
                whereParts.push(`threadId IN (${threadIds.map(() => '?').join(',')})`);
                params.push(...threadIds);
            }

            const [rows] = await pool.execute(
                `SELECT groupId, threadId, lastSeenAt FROM \`ChatLastSeen\` WHERE userId = ? AND (${whereParts.join(' OR ')})`,
                params
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
                'SELECT COUNT(*) as count FROM `Message` WHERE groupId = ? AND threadId IS NULL AND createdAt > ?',
                [groupId, lastSeenAt]
            );
            return rows[0].count;
        }

        async function unreadForThread(threadId) {
            const lastSeenAt = seenThread.get(threadId) || new Date(0);
            const [rows] = await pool.execute(
                'SELECT COUNT(*) as count FROM `Message` WHERE threadId = ? AND groupId IS NULL AND createdAt > ?',
                [threadId, lastSeenAt]
            );
            return rows[0].count;
        }

        const groupUnread = await Promise.all(groupIds.map(unreadForGroup));
        const threadUnread = await Promise.all(threadIds.map(unreadForThread));

        const unreadTotal =
            groupUnread.reduce((a, b) => a + b, 0) + threadUnread.reduce((a, b) => a + b, 0);

        // Latest 3 uploaded files
        const [latestFiles] = await pool.execute(
            `SELECT
                f.id,
                f.originalName,
                f.mimeType,
                f.size,
                f.createdAt,
                f.folderId,
                fo.name as folderName
            FROM File f
            LEFT JOIN Folder fo ON f.folderId = fo.id
            WHERE f.uploaderId = ?
            ORDER BY f.createdAt DESC
            LIMIT 3`,
            [userId]
        );

        const files = latestFiles.map((f) => ({
            id: f.id,
            originalName: f.originalName,
            mimeType: f.mimeType,
            size: f.size,
            createdAt: f.createdAt,
            folderId: f.folderId,
            folderName: f.folderName || null,
        }));

        return res.json({
            ok: true,
            unreadTotal,
            latestFiles: files,
        });
    } catch (e) {
        console.log("Error caught in getDashboard controller's catch block");
        console.error(e);
        next(e); // Pass the error to the global error handler
    }
}
