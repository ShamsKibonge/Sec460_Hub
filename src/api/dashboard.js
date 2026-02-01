import { API_BASE_URL } from "../config";

function authHeaders() {
    const token = localStorage.getItem("portal_token");
    return { Authorization: `Bearer ${token}` };
}

export async function getDashboard() {
    const res = await fetch(`${API_BASE_URL}/api/v1/dashboard`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load dashboard");
    return data; // { unreadTotal, files }
}
