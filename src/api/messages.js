import { getToken } from "../auth/token";
import { API_BASE_URL } from "../config";

function authHeaders() {
    const token = getToken();
    return { Authorization: `Bearer ${token}` };
}

export async function getInbox() {
    const res = await fetch(`${API_BASE_URL}/api/v1/messages/inbox`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load inbox");
    return data.items;
}

export async function getGroupMessages(groupId) {
    const res = await fetch(`${API_BASE_URL}/api/v1/messages/groups/${groupId}`, {
        headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load group messages");
    return data.messages;
}

// export async function sendGroupMessage(groupId, text) {
//     const res = await fetch(`${API_BASE_URL}/api/v1/messages/groups/${groupId}`, {
//         method: "POST",
//         headers: { ...authHeaders(), "Content-Type": "application/json" },
//         body: JSON.stringify({ text }),
//     });
//     const data = await res.json();
//     if (!res.ok) throw new Error(data.error || "Failed to send message");
//     return data.message;
// }
export async function sendGroupMessage(groupId, text) {
    const res = await fetch(`${API_BASE_URL}/api/v1/messages/groups/${groupId}`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to send group message");

    // ✅ return the actual message that renders in the chat box
    return data.message;
}

export async function getDirectMessages(threadId) {
    const res = await fetch(`${API_BASE_URL}/api/v1/messages/direct/${threadId}`, {
        headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load direct messages");
    return data.messages;
}

// export async function sendDirectMessage(toEmail, text) {
//     const res = await fetch(`${API_BASE_URL}/api/v1/messages/direct`, {
//         method: "POST",
//         headers: { ...authHeaders(), "Content-Type": "application/json" },
//         body: JSON.stringify({ toEmail, text }),
//     });
//     const data = await res.json();
//     if (!res.ok) throw new Error(data.error || "Failed to send direct message");
//     return data; // { threadId, message }
// }

export async function sendDirectMessage(toEmail, text) {
    const res = await fetch(`${API_BASE_URL}/api/v1/messages/direct`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail, text }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to send direct message");

    // ✅ keep threadId for logic, but ensure message exists
    return { threadId: data.threadId, message: data.message };
}

export async function markSeen(scope, chatId) {
    const res = await fetch(`${API_BASE_URL}/api/v1/messages/seen`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ scope, chatId }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to mark chat as seen");
    return data;
}
