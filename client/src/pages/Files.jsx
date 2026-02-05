import { useEffect, useMemo, useRef, useState } from "react";

import { useUser } from "../context/UserContext";



async function apiGet(url) {
    const token = localStorage.getItem("portal_token");
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
}

async function apiPostJson(url, body) {
    const token = localStorage.getItem("portal_token");
    const res = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
}

async function apiUpload(url, formData) {
    const token = localStorage.getItem("portal_token");
    const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return data;
}

export default function Files() {
    const { user } = useUser();
    const [path, setPath] = useState([]);
    const fileInputRef = useRef(null);
    const [preview, setPreview] = useState(null);


    const [folderId, setFolderId] = useState(null); // null = root
    const [folders, setFolders] = useState([]);
    const [files, setFiles] = useState([]);

    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [msg, setMsg] = useState("");

    const [newFolderName, setNewFolderName] = useState("");

    const title = useMemo(() => (folderId ? "Files" : "Files (Root)"), [folderId]);
    const [q, setQ] = useState("")

    // async function load() {
    //     setErr("");
    //     setMsg("");
    //     setLoading(true);
    //     try {
    //         const params = new URLSearchParams();

    //         if (folderId) params.set("folderId", folderId);
    //         if (q.trim()) params.set("q", q.trim());

    //         const suffix = params.toString() ? `?${params.toString()}` : "";

    //         const data = await apiGet(`/api/v1/drive/contents${suffix}`);

    //         setFolders(data.folders || []);
    //         setFiles(data.files || []);
    //         setPath(data.path || []);
    //     } catch (e) {
    //         setErr(e.message);
    //     } finally {
    //         setLoading(false);
    //     }
    // }

    async function load({ nextFolderId = folderId, nextQ = q } = {}) {
        setErr("");
        setMsg("");
        setLoading(true);

        try {
            const params = new URLSearchParams();
            if (nextFolderId) params.set("folderId", nextFolderId);
            if (nextQ.trim()) params.set("q", nextQ.trim());

            const suffix = params.toString() ? `?${params.toString()}` : "";
            const data = await apiGet(`/api/v1/drive/contents${suffix}`);

            setFolders(data.folders || []);
            setFiles(data.files || []);
            setPath(data.path || []);
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    }


    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [folderId]);

    async function onCreateFolder(e) {
        e.preventDefault();
        const name = newFolderName.trim();
        if (!name) return;

        setErr("");
        setMsg("");
        try {
            await apiPostJson("/api/v1/drive/folders", { name, parentId: folderId });
            setNewFolderName("");
            setMsg("Folder created.");
            await load();
        } catch (e) {
            setErr(e.message);
        }
    }

    async function downloadWithToken(fileId, originalName = "download") {
        const token = localStorage.getItem("portal_token");

        const res = await fetch(`/api/v1/drive/files/${fileId}/download`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        // If server returns JSON error, this makes it readable
        const contentType = res.headers.get("content-type") || "";
        if (!res.ok) {
            if (contentType.includes("application/json")) {
                const data = await res.json();
                throw new Error(data.error || "Download failed");
            }
            throw new Error("Download failed");
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = originalName;
        document.body.appendChild(a);
        a.click();
        a.remove();

        window.URL.revokeObjectURL(url);
    }

    async function deleteFolderById(folderId) {
        const token = localStorage.getItem("portal_token");
        const res = await fetch(`/api/v1/drive/folders/${folderId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Delete folder failed");
        return data;
    }



    async function onUpload(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        setErr("");
        setMsg("");

        try {
            const fd = new FormData();
            // root => send empty OR omit (either is fine). we’ll send null by omitting:
            if (folderId) fd.append("folderId", folderId);
            fd.append("file", file);

            await apiUpload("/api/v1/drive/files", fd);
            setMsg("File uploaded.");
            e.target.value = "";
            await load();
        } catch (e) {
            setErr(e.message);
        }
    }

    async function deleteFileById(fileId) {
        const token = localStorage.getItem("portal_token");
        const res = await fetch(`/api/v1/drive/files/${fileId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Delete failed");
        return data;
    }

    async function renameFileById(fileId, name) {
        const token = localStorage.getItem("portal_token");
        const res = await fetch(`/api/v1/drive/files/${fileId}`, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ name }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Rename failed");
        return data;
    }

    async function renameFolderById(folderId, name) {
        const token = localStorage.getItem("portal_token");
        const res = await fetch(`/api/v1/drive/folders/${folderId}`, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ name }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Rename folder failed");
        return data;
    }

    async function openPreviewWithToken(fileId, name) {
        const token = localStorage.getItem("portal_token");

        const res = await fetch(`/api/v1/drive/files/${fileId}/download`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        const contentType = res.headers.get("content-type") || "";

        if (!res.ok) {
            const data = contentType.includes("application/json")
                ? await res.json()
                : {};
            throw new Error(data.error || "Preview failed");
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);

        // If it's an image or pdf, show modal
        if (contentType.startsWith("image/") || contentType === "application/pdf") {
            setPreview({ url, name, mimeType: contentType });
            return;
        }

        // otherwise open in a new tab (or just download)
        window.open(url, "_blank", "noopener,noreferrer");
    }

    function closePreview() {
        if (preview?.url) window.URL.revokeObjectURL(preview.url);
        setPreview(null);
    }

    function onClear() {
        setQ("");
        load({ nextQ: "" }); // ✅ reload folder with NO search filter
    }



    return (
        <div className="p-4 h-[calc(100vh-80px)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h1 className="text-xl font-bold">{title}</h1>
                    <p className="text-sm text-gray-600">
                        Logged in as <b>{user?.alias || user?.email}</b>
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                        <button
                            type="button"
                            onClick={() => setFolderId(null)}
                            className="underline hover:opacity-80"
                        >
                            Root
                        </button>

                        {path.map((p) => (
                            <div key={p.id} className="flex items-center gap-2">
                                <span>/</span>
                                <button
                                    type="button"
                                    onClick={() => setFolderId(p.id)}
                                    className="underline hover:opacity-80"
                                >
                                    {p.name}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* hidden real input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        onChange={onUpload}
                        className="hidden"
                    />

                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-lg bg-black px-3 py-2 text-sm text-white hover:opacity-90"
                    >
                        Upload
                    </button>

                    {folderId && (
                        <button
                            type="button"
                            onClick={() => setFolderId(null)}
                            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                        >
                            Back to Root
                        </button>
                    )}

                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && load()}
                        placeholder="Search…"
                        className="w-32 rounded-lg border px-3 py-2 text-sm sm:w-48"
                    />

                    <button onClick={() => load()} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
                        Search
                    </button>

                    <button
                        onClick={onClear}
                        className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                    >
                        Clear
                    </button>

                    <button
                        type="button"
                        onClick={() => load()}
                        className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {(msg || err) && (
                <div className="mb-4 space-y-2">
                    {msg && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm">{msg}</div>}
                    {err && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">{err}</div>}
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-3 h-full min-h-0">


                {/* Left: actions */}
                <div className="rounded-2xl border bg-white p-4 shadow-sm">
                    <h2 className="font-semibold">Actions</h2>

                    <form onSubmit={onCreateFolder} className="mt-3 space-y-2">
                        <label className="block text-sm font-medium">Create folder</label>
                        <div className="flex gap-2">
                            <input
                                className="flex-1 rounded-lg border px-3 py-2 text-sm"
                                placeholder="e.g. Docs"
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                            />
                            <button className="rounded-lg bg-black px-3 py-2 text-sm text-white hover:opacity-90">
                                Create
                            </button>
                        </div>
                    </form>

                    {/* <div className="mt-4 space-y-2">
                        <label className="block text-sm font-medium">Upload file</label>
                        <input type="file" onChange={onUpload} className="block w-full text-sm" />
                        <p className="text-xs text-gray-500">
                            Uploads into the current folder.
                        </p>
                    </div> */}
                </div>

                {/* Right: contents */}
                <div className="md:col-span-2 rounded-2xl border bg-white p-4 shadow-sm flex flex-col min-h-0">

                    <h2 className="font-semibold">Contents</h2>

                    {loading ? (
                        <div className="mt-3 text-sm text-gray-600">Loading…</div>
                    ) : (
                        <div className="mt-3 flex-1 overflow-auto rounded-xl border bg-gray-50 p-3 space-y-4">

                            <div>
                                <div className="text-sm font-medium text-gray-700">Folders</div>
                                {folders.length === 0 ? (
                                    <div className="text-sm text-gray-600">No folders.</div>
                                ) : (
                                    <ul className="mt-2 space-y-2">
                                        {folders.map((f) => (
                                            <li key={f.id}>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setFolderId(f.id)}
                                                        className="flex-1 rounded-lg border px-3 py-2 text-left text-sm hover:bg-gray-50"
                                                    >
                                                        📁 {f.name}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                                                        onClick={async () => {
                                                            const ok = window.confirm(`Delete folder "${f.name}"? (must be empty)`);
                                                            if (!ok) return;

                                                            try {
                                                                await deleteFolderById(f.id);
                                                                setMsg("Folder deleted.");
                                                                await load();
                                                            } catch (e) {
                                                                setErr(e.message);
                                                            }
                                                        }}
                                                    >
                                                        Delete
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                                                        onClick={async () => {
                                                            const next = window.prompt("Rename folder to:", f.name);
                                                            if (!next) return;

                                                            try {
                                                                await renameFolderById(f.id, next.trim());
                                                                setMsg("Folder renamed.");
                                                                await load();
                                                            } catch (e) {
                                                                setErr(e.message);
                                                            }
                                                        }}
                                                    >
                                                        Rename
                                                    </button>
                                                </div>

                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div>
                                <div className="text-sm font-medium text-gray-700">Files</div>
                                {files.length === 0 ? (
                                    <div className="text-sm text-gray-600">No files.</div>
                                ) : (
                                    <ul className="mt-2 space-y-2">
                                        {files.map((f) => (
                                            <li key={f.id} className="rounded-lg border p-3 text-sm">
                                                <div className="font-medium truncate">📄 {f.originalName}</div>
                                                <div className="text-xs text-gray-500">
                                                    {(f.size / 1024).toFixed(1)} KB • {f.mimeType}
                                                </div>
                                                <div className="mt-2 flex gap-2">
                                                    <button
                                                        type="button"
                                                        className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                                                        onClick={async () => {
                                                            try {
                                                                await downloadWithToken(f.id, f.originalName);
                                                            } catch (e) {
                                                                setErr(e.message);
                                                            }
                                                        }}
                                                    >
                                                        Download
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                                                        onClick={async () => {
                                                            const ok = window.confirm(`Delete "${f.originalName}"?`);
                                                            if (!ok) return;

                                                            try {
                                                                await deleteFileById(f.id);
                                                                setMsg("File deleted.");
                                                                await load();
                                                            } catch (e) {
                                                                setErr(e.message);
                                                            }
                                                        }}
                                                    >
                                                        Delete
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                                                        onClick={async () => {
                                                            const next = window.prompt("Rename file to:", f.originalName);
                                                            if (!next) return;

                                                            try {
                                                                await renameFileById(f.id, next.trim());
                                                                setMsg("File renamed.");
                                                                await load();
                                                            } catch (e) {
                                                                setErr(e.message);
                                                            }
                                                        }}
                                                    >
                                                        Rename
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                                                        onClick={async () => {
                                                            try {
                                                                await openPreviewWithToken(f.id, f.originalName);
                                                            } catch (e) {
                                                                setErr(e.message);
                                                            }
                                                        }}
                                                    >
                                                        Preview
                                                    </button>

                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                {preview && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="w-full max-w-4xl rounded-2xl bg-white p-4 shadow-lg">
                            <div className="mb-3 flex items-center justify-between">
                                <div className="min-w-0">
                                    <div className="truncate font-semibold">{preview.name}</div>
                                    <div className="text-xs text-gray-500">{preview.mimeType}</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={closePreview}
                                    className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                                >
                                    Close
                                </button>
                            </div>

                            <div className="h-[70vh] overflow-auto rounded-xl border bg-gray-50">
                                {preview.mimeType.startsWith("image/") ? (
                                    <img src={preview.url} alt={preview.name} className="mx-auto max-h-[70vh] p-4" />
                                ) : (
                                    <iframe title="pdf-preview" src={preview.url} className="h-[70vh] w-full" />
                                )}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
