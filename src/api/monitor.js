import { getToken } from "../auth/token";
import { API_BASE_URL } from "../config";

function authHeaders() {
    const token = getToken();
    if (token) {
        return { Authorization: `Bearer ${token}` };
    }
    return {};
}

export async function getAllChats() {
    const res = await fetch(`${API_BASE_URL}/api/v1/monitor/chats`, {
        headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to fetch chats");
    return data;
}

export async function getChatMessages(type, id) {
    const res = await fetch(`${API_BASE_URL}/api/v1/monitor/chats/${type}/${id}`, {
        headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to fetch chat messages");
    return data;
}
