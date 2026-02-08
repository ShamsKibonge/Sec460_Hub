// server/src.socket.js
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import pool from "./db/mysql.js";

let io;

export function initSocket(httpServer) {
    // Use the API-prefixed path so reverse proxies and clients using `/api/socket.io` work
    io = new Server(httpServer, { path: "/api/socket.io", cors: { origin: true, credentials: true } });

    io.use((socket, next) => {
        try {
            const token = socket.handshake?.auth?.token;
            if (!token) return next(new Error("Missing token"));
            const payload = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = payload.userId;
            next();
        } catch {
            next(new Error("Invalid token"));
        }
    });

    io.on("connection", (socket) => {
        socket.join(`user:${socket.userId}`);

        socket.on("chat:join", async ({ type, id }) => {
            try {
                if (!type || !id) return;

                if (type === "group") {
                    const [rows] = await pool.execute(
                        'SELECT `id` FROM `GroupMember` WHERE `groupId` = ? AND `userId` = ?',
                        [id, socket.userId]
                    );
                    const isMember = rows[0];
                    if (!isMember) return;
                    socket.join(`group:${id}`);
                }

                if (type === "direct") {
                    const [rows] = await pool.execute(
                        'SELECT `userAId`, `userBId` FROM `DirectThread` WHERE `id` = ?',
                        [id]
                    );
                    const thread = rows[0];
                    if (!thread) return;
                    if (thread.userAId !== socket.userId && thread.userBId !== socket.userId) return;
                    socket.join(`thread:${id}`);
                }
            } catch { }
        });

        socket.on("chat:leave", ({ type, id }) => {
            if (!type || !id) return;
            if (type === "group") socket.leave(`group:${id}`);
            if (type === "direct") socket.leave(`thread:${id}`);
        });
    });

    return io;
}

export function getIO() {
    if (!io) throw new Error("Socket.io not initialized");
    return io;
}
