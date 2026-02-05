import cuid from "cuid";
import pool from "../db/mysql.js";

/**
 * Logs a user activity to the database.
 * @param {string | null} userId - The ID of the user performing the action. Can be null for actions without a user context (e.g., failed login attempt with unknown user).
 * @param {string} activityType - The type of activity (e.g., 'AUTH_LOGIN_SUCCESS').
 * @param {object | null} details - A JSON object for extra details, like the target user's ID.
 */
export async function logActivity(userId, activityType, details = null) {
    try {
        const newId = cuid();
        await pool.execute(
            'INSERT INTO `UserActivity` (`id`, `userId`, `activityType`, `details`) VALUES (?, ?, ?, ?)',
            [newId, userId, activityType, details ? JSON.stringify(details) : null]
        );
    } catch (e) {
        // Log to console, but don't let logging failure break the original request.
        console.error("Failed to log user activity:", e);
    }
}
