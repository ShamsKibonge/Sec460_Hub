import { getToken } from "../auth/token";
import { API_BASE_URL } from "../config";

export async function requestCode(email) {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request code failed");
    return data;
}

export async function verifyCode(email, code) {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Verify code failed");
    return data; // includes token + user
}

export async function logout() {
    const token = getToken();
    if (!token) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });
        const data = await res.json();
        if (!res.ok) console.error("Logout failed on server:", data.error);
    } catch (e) {
        console.error("Logout request failed:", e);
    }
}
