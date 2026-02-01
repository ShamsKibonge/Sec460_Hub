import { getToken } from "../auth/token";

function authHeaders() {
    const token = getToken();
    return { Authorization: `Bearer ${token}` };
}

export async function listMyGroups() {
    const res = await fetch("/api/v1/groups", { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load groups");
    return data.groups;
}

export async function createGroup(name) {
    const res = await fetch("/api/v1/groups", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to create group");
    return data.group;
}

export async function listMembers(groupId) {
    const res = await fetch(`/api/v1/groups/${groupId}/members`, {
        headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load members");
    return data.members;
}

export async function addMember(groupId, email) {
    const res = await fetch(`/api/v1/groups/${groupId}/members`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to add member");
    return data;
}
