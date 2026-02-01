import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { requestCode, verifyCode } from "../api/auth";
import { setToken } from "../auth/token";
import { connectSocket } from "../realtime/socket";
import { useUser } from "../context/UserContext";


export default function Login() {
    const nav = useNavigate();
    const { setUser } = useUser();
    const [step, setStep] = useState(1); // 1=email, 2=code
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);

    async function onRequestCode(e) {
        e.preventDefault();
        setErr("");
        setMsg("");
        setLoading(true);
        try {
            await requestCode(email);
            setMsg("Code sent. Check your email.");
            setStep(2);
        } catch (ex) {
            setErr(ex.message);
        } finally {
            setLoading(false);
        }
    }

    async function onVerify(e) {
        e.preventDefault();
        setErr("");
        setMsg("");
        setLoading(true);
        try {
            const data = await verifyCode(email, code);
            setToken(data.token);
            setUser(data.user); // Immediately update the user context
            connectSocket();

            if (data.needsOnboarding) nav("/onboarding");
            else nav("/dashboard");
        } catch (ex) {
            setErr(ex.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
                <h1 className="text-2xl font-bold">Sign in</h1>
                <p className="mt-1 text-sm text-gray-600">
                    Enter your email address to receive a login code.
                </p>

                {msg && (
                    <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
                        {msg}
                    </div>
                )}
                {err && (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                        {err}
                    </div>
                )}

                {step === 1 && (
                    <form className="mt-6 space-y-3" onSubmit={onRequestCode}>
                        <label className="block text-sm font-medium">Email</label>
                        <input
                            className="w-full rounded-lg border px-3 py-2"
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />

                        <button
                            disabled={loading}
                            className="w-full rounded-lg bg-black px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
                        >
                            {loading ? "Sending..." : "Get code"}
                        </button>
                    </form>
                )}

                {step === 2 && (
                    <form className="mt-6 space-y-3" onSubmit={onVerify}>
                        <div className="text-sm text-gray-600">
                            Code sent to <b>{email}</b>
                        </div>

                        <label className="block text-sm font-medium">6-digit code</label>
                        <input
                            className="w-full rounded-lg border px-3 py-2"
                            placeholder="123456"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                        />

                        <button
                            disabled={loading}
                            className="w-full rounded-lg bg-black px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
                        >
                            {loading ? "Verifying..." : "Verify & login"}
                        </button>

                        <button
                            type="button"
                            className="w-full rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
                            onClick={() => {
                                setStep(1);
                                setCode("");
                                setMsg("");
                                setErr("");
                            }}
                        >
                            Back
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
