import { io } from "socket.io-client";
import { getToken } from "../auth/token";

let socket = null;

// export function connectSocket() {
//     const token = getToken();
//     if (!token) return null;

//     if (socket) return socket;

//     const base = window.location.origin;

//     // socket = io("http://portal.sofkam.com/api:80", {
//     //     auth: { token },
//     //     transports: ["websocket"],
//     // });

//     socket = io(base, {
//         path: "/socket.io",
//         transports: ["websocket"],
//         auth: token ? { token } : undefined,
//         withCredentials: true,
//     });

//     return socket;
// }
export function connectSocket() {
    const token = getToken();
    if (!token) return null;

    if (socket?.connected) return socket;

    socket = io("http://portal.sofkam.com", {
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
