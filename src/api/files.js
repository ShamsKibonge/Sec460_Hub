import { getToken } from "../auth/token";

function authHeaders() {
    const token = getToken();
    return { Authorization: `Bearer ${token}` };
}

export async function listGroupFiles(groupId) {
    const res = await fetch(`/api/v1/files/groups/${groupId}`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load files");
    return data.files;
}

export async function listThreadFiles(threadId) {
    const res = await fetch(`/api/v1/files/direct/${threadId}`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load files");
    return data.files;
}

export async function uploadGroupFile(groupId, file) {
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch(`/api/v1/files/groups/${groupId}/upload`, {
        method: "POST",
        headers: authHeaders(),
        body: fd,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return data.file;
}

export async function uploadThreadFile(threadId, file) {
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch(`/api/v1/files/direct/${threadId}/upload`, {
        method: "POST",
        headers: authHeaders(),
        body: fd,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return data.file;
}

export function downloadUrl(fileId) {
    return `/api/v1/files/${fileId}/download`;
}

export async function downloadFile(fileId) {
    const res = await fetch(`/api/v1/files/${fileId}/download`, {
        headers: authHeaders(),
    });

    if (!res.ok) {
        let msg = "Download failed";
        try {
            const data = await res.json();
            msg = data.error || msg;
        } catch { }
        throw new Error(msg);
    }

    return res.blob();
}

export async function fetchFileBlob(fileId) {
    const res = await fetch(`/api/v1/files/${fileId}/download`, {
        headers: authHeaders(),
    });

    if (!res.ok) {
        let msg = "Failed to load file";
        try {
            const data = await res.json();
            msg = data.error || msg;
        } catch { }
        throw new Error(msg);
    }

    return res.blob();
}

