import { getToken } from "../auth/token";

function authHeaders() {
    const token = getToken();
    if (token) {
        return { Authorization: `Bearer ${token}` };
    }
    return {};
}

export async function getAllUsers() {
    const res = await fetch("/api/v1/users", {
        headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to fetch users");
    return data;
}

export async function setUserAdminStatus(userId, isAdmin) {
    const res = await fetch("/api/v1/users/admin", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
        },
        body: JSON.stringify({ userId, isAdmin }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to set admin status");
    return data;
}

export async function setUserActiveStatus(userId, isActive) {
    const res = await fetch("/api/v1/users/active", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
        },
        body: JSON.stringify({ userId, isActive }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to set active status");
    return data;
}


export async function setMyAlias(alias) {
    const res = await fetch("/api/v1/users/me/alias", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
        },
        body: JSON.stringify({ alias }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to set alias");
    return data;
}
