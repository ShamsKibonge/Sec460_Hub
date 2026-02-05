import cuid from "cuid";
import jwt from "jsonwebtoken";
import pool from "../db/mysql.js";

export function initSocket(io) {
    // ✅ Authenticate socket connection using JWT
    io.use((socket, next) => {
        try {
            const token = socket.handshake?.auth?.token;
            if (!token) return next(new Error("Missing token"));

            const payload = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = payload.userId;
            next();
        } catch (e) {
            if (e.name === 'TokenExpiredError') {
                return next(new Error("Token expired"));
            } else if (e.name === 'JsonWebTokenError') {
                return next(new Error("Invalid token"));
            } else {
                return next(new Error("Authentication error"));
            }
        }
    });

    io.on("connection", async (socket) => {
        try {
            const newId = cuid();
            await pool.execute(
                'INSERT INTO `UserActivity` (`id`, `userId`, `activityType`) VALUES (?, ?, ?)',
                [newId, socket.userId, 'connection']
            );
        } catch (e) {
            console.error(e);
        }
        // personal room (optional but useful later)
        socket.join(`user:${socket.userId}`);

        // ✅ join a chat room when user opens a chat
        socket.on("chat:join", async ({ type, id }) => {
            try {
                if (!type || !id) return;

                if (type === "group") {
                    const [rows] = await pool.execute(
                        'SELECT `id` FROM `GroupMember` WHERE `groupId` = ? AND `userId` = ?',
                        [id, socket.userId]
                    );
                    const isMember = rows[0];
                    if (!isMember) return; // silently ignore
                    socket.join(`group:${id}`);
                }

                if (type === "direct") {
                    const [rows] = await pool.execute(
                        'SELECT `userAId`, `userBId` FROM `DirectThread` WHERE `id` = ?',
                        [id]
                    );
                    const thread = rows[0];
                    if (!thread) return;

                    const allowed =
                        thread.userAId === socket.userId || thread.userBId === socket.userId;
                    if (!allowed) return;

                    socket.join(`thread:${id}`);
                }
            } catch {
                // ignore
            }
        });

        socket.on("chat:leave", ({ type, id }) => {
            if (!type || !id) return;
            if (type === "group") socket.leave(`group:${id}`);
            if (type === "direct") socket.leave(`thread:${id}`);
        });
    });
}
