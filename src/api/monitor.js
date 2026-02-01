import { getToken } from "../auth/token";

function authHeaders() {
    const token = getToken();
    if (token) {
        return { Authorization: `Bearer ${token}` };
    }
    return {};
}

export async function getAllChats() {
    const res = await fetch("/api/v1/monitor/chats", {
        headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to fetch chats");
    return data;
}

export async function getChatMessages(type, id) {
    const res = await fetch(`/api/v1/monitor/chats/${type}/${id}`, {
        headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to fetch chat messages");
    return data;
}
