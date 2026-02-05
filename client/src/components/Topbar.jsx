import { Bars3Icon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { clearToken } from "../auth/token";
import { useUser } from "../context/UserContext";
import { disconnectSocket } from "../realtime/socket";
import { logout } from "../api/auth";

export default function Topbar({ setSidebarOpen }) {
    const nav = useNavigate();
    const { user, loading } = useUser();

    const displayName = user?.alias || user?.email || "there";
    const isSuperAdmin = user?.isSuperAdmin;

    const headerClasses = `flex h-14 items-center justify-between border-b px-4 ${
        isSuperAdmin ? "bg-yellow-500 text-white border-yellow-600" : "bg-white text-gray-600"
    }`;
    const buttonBaseClasses = `rounded-lg px-3 py-1.5 text-sm transition ${
        isSuperAdmin ? "text-white border-yellow-300 hover:bg-yellow-600" : "border hover:bg-gray-50"
    }`;

    return (
        <header className={headerClasses}>
            <div className="flex items-center gap-2">
                <button
                    className={`rounded-lg p-1 lg:hidden ${
                        isSuperAdmin ? "text-white hover:bg-yellow-600" : "text-gray-500 hover:bg-gray-100"
                    }`}
                    onClick={() => setSidebarOpen(true)}
                >
                    <Bars3Icon className="h-6 w-6" />
                </button>
                <div className="text-sm">
                    {!loading && (
                        <>
                            Welcome <b>{displayName}</b> 👋
                        </>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button
                    className={`hidden sm:block ${buttonBaseClasses}`}
                    onClick={() => {
                        nav("/messages");
                    }}
                >
                    New Message
                </button>
                <button className={`hidden sm:block ${buttonBaseClasses}`}>
                    Upload File
                </button>

                <button
                    className={buttonBaseClasses}
                    onClick={async () => {
                        await logout(); // Log the event on the server
                        clearToken();
                        disconnectSocket();
                        nav("/login");
                    }}
                >
                    Logout
                </button>
            </div>
        </header>
    );
}
