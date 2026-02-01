import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setMyAlias } from "../api/users";

export default function Onboarding() {
    const nav = useNavigate();
    const [alias, setAlias] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);

    async function onSubmit(e) {
        e.preventDefault();
        setErr("");
        setLoading(true);
        try {
            await setMyAlias(alias);
            nav("/dashboard");
        } catch (ex) {
            setErr(ex.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
                <h1 className="text-2xl font-bold">Choose your alias</h1>
                <p className="mt-1 text-sm text-gray-600">
                    People will see this name in messages (not your email).
                </p>

                {err && (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                        {err}
                    </div>
                )}

                <form className="mt-6 space-y-3" onSubmit={onSubmit}>
                    <label className="block text-sm font-medium">Alias</label>
                    <input
                        className="w-full rounded-lg border px-3 py-2"
                        placeholder="Shams_01"
                        value={alias}
                        onChange={(e) => setAlias(e.target.value)}
                    />

                    <button
                        disabled={loading}
                        className="w-full rounded-lg bg-black px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
                    >
                        {loading ? "Saving..." : "Save alias"}
                    </button>
                </form>
            </div>
        </div>
    );
}
