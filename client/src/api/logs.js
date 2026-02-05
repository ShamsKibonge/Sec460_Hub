import { getToken } from "../auth/token";
import { API_BASE_URL } from "../config";

function authHeaders() {
    const token = getToken();
    if (token) {
        return { Authorization: `Bearer ${token}` };
    }
    return {};
}

export async function getLogs() {
    const res = await fetch(`${API_BASE_URL}/api/v1/logs`, {
        headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to fetch logs");
    return data;
}
