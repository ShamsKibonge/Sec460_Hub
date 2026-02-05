import { getToken } from "../auth/token";
import { API_BASE_URL } from "../config";

export async function getMe() {
    const token = getToken();
    const res = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to fetch user");
    return data.user;
}
