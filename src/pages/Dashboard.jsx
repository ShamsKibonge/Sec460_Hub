import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDashboard } from "../api/dashboard";

export default function Dashboard() {
    const nav = useNavigate();
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [unreadTotal, setUnreadTotal] = useState(0);
    const [files, setFiles] = useState([]);

    async function load() {
        setErr("");
        setLoading(true);
        try {
            const data = await getDashboard();
            setUnreadTotal(data.unreadTotal || 0);
            setFiles(data.files || []);
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    return (
        <div className="p-4">
            <div className="mb-4 flex items-center justify-between">
                <h1 className="text-xl font-bold">Dashboard</h1>
                <button onClick={load} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
                    Refresh
                </button>
            </div>

            {err && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                    {err}
                </div>
            )}

            {loading ? (
                <div className="text-sm text-gray-600">Loading…</div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {/* Card 1: Unread */}
                    <button
                        onClick={() => nav("/messages")}
                        className="rounded-2xl border bg-white p-5 text-left shadow-sm hover:bg-gray-50"
                    >
                        <div className="text-sm text-gray-500">Unread messages</div>
                        <div className="mt-2 flex items-center justify-between">
                            <div className="text-3xl font-bold">{unreadTotal}</div>
                            <div className="rounded-full border px-3 py-1 text-sm">Open</div>
                        </div>
                        <div className="mt-3 text-xs text-gray-500">
                            Click to go to Messages
                        </div>
                    </button>

                    {/* Card 2: Recent files */}
                    <button
                        onClick={() => nav("/files")}
                        className="rounded-2xl border bg-white p-5 text-left shadow-sm hover:bg-gray-50"
                    >
                        <div className="text-sm text-gray-500">Recent uploads</div>

                        {files.length === 0 ? (
                            <div className="mt-3 text-sm text-gray-600">No files yet.</div>
                        ) : (
                            <ul className="mt-3 space-y-2">
                                {files.map((f) => (
                                    <li key={f.id} className="rounded-lg border bg-white p-3">
                                        <div className="truncate text-sm font-medium">📄 {f.originalName}</div>
                                        <div className="mt-1 text-xs text-gray-500 truncate">
                                            {f.path} • {(f.size / 1024).toFixed(1)} KB
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}

                        <div className="mt-3 text-xs text-gray-500">
                            Click to go to Files
                        </div>
                    </button>
                </div>
            )}
        </div>
    );
}
