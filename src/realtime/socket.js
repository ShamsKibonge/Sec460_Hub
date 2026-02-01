import { io } from "socket.io-client";
import { getToken } from "../auth/token";
import { API_BASE_URL } from "../config";

let socket = null;

export function connectSocket() {
    const token = getToken();
    if (!token) return null;

    if (socket?.connected) return socket;

    socket = io(API_BASE_URL, {
        path: "/api/socket.io",
        auth: { token },
        transports: ["polling"], // safest on cPanel
        withCredentials: true,
    });

    socket.on("connect_error", (err) => {
        console.log("socket connect_error:", err?.message || err);
    });

    return socket;
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

export function getSocket() {
    return socket;
}
