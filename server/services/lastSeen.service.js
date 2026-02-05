import pool from "../db/mysql.js";
import cuid from "cuid";

export async function markGroupSeen(userId, groupId) {
    const now = new Date();
    await pool.execute(
        'INSERT INTO `ChatLastSeen` (id, userId, groupId, lastSeenAt, updatedAt) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE lastSeenAt = VALUES(lastSeenAt), updatedAt = VALUES(updatedAt)',
        [cuid(), userId, groupId, now, now]
    );
}

export async function markThreadSeen(userId, threadId) {
    const now = new Date();
    await pool.execute(
        'INSERT INTO `ChatLastSeen` (id, userId, threadId, lastSeenAt, updatedAt) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE lastSeenAt = VALUES(lastSeenAt), updatedAt = VALUES(updatedAt)',
        [cuid(), userId, threadId, now, now]
    );
}
