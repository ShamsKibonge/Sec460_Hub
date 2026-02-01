import { getToken } from "../auth/token";

export async function getMe() {
    const token = getToken();
    const res = await fetch("/api/v1/users/me", {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to fetch user");
    return data.user;
}
