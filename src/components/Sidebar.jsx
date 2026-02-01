import {
    HomeIcon,
    ChatBubbleLeftRightIcon,
    FolderIcon,
    UsersIcon,
    XMarkIcon,
    UserGroupIcon,
    EyeIcon,
    DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { NavLink } from "react-router-dom";
import { useUser } from "../context/UserContext";

const linkBase =
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-gray-100";
const linkActive = "bg-gray-100 font-semibold";

export default function Sidebar({ isSidebarOpen, setSidebarOpen }) {
    const { user } = useUser();

    return (
        <aside
            className={`
                absolute z-20 h-full w-64 border-r bg-white p-3 transition-transform
                ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
                lg:static lg:translate-x-0
            `}
        >
            <div className="flex items-center justify-between px-3 py-2">
                <div>
                    <div className="text-lg font-bold">Portal Hub</div>
                    <div className="text-xs text-gray-500">Messaging • Files • Groups</div>
                </div>
                <button
                    className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                >
                    <XMarkIcon className="h-6 w-6" />
                </button>
            </div>

            <nav className="mt-4 space-y-1">
                <NavLink
                    to="/dashboard"
                    className={({ isActive }) =>
                        `${linkBase} ${isActive ? linkActive : ""}`
                    }
                >
                    <HomeIcon className="h-5 w-5" />
                    Dashboard
                </NavLink>

                <NavLink
                    to="/messages"
                    className={({ isActive }) =>
                        `${linkBase} ${isActive ? linkActive : ""}`
                    }
                >
                    <ChatBubbleLeftRightIcon className="h-5 w-5" />
                    Messages
                </NavLink>

                <NavLink
                    to="/files"
                    className={({ isActive }) =>
                        `${linkBase} ${isActive ? linkActive : ""}`
                    }
                >
                    <FolderIcon className="h-5 w-5" />
                    Files
                </NavLink>

                <NavLink
                    to="/groups"
                    className={({ isActive }) =>
                        `${linkBase} ${isActive ? linkActive : ""}`
                    }
                >
                    <UsersIcon className="h-5 w-5" />
                    Groups
                </NavLink>

                {!!(user?.isAdmin || user?.isSuperAdmin) && (
                    <NavLink
                        to="/users"
                        className={({ isActive }) =>
                            `${linkBase} ${isActive ? linkActive : ""}`
                        }
                    >
                        <UserGroupIcon className="h-5 w-5" />
                        Users
                    </NavLink>
                )}

                {!!user?.isSuperAdmin && (
                    <NavLink
                        to="/monitor"
                        className={({ isActive }) =>
                            `${linkBase} ${isActive ? linkActive : ""}`
                        }
                    >
                        <EyeIcon className="h-5 w-5" />
                        Monitor
                    </NavLink>
                )}

                {!!user?.isSuperAdmin && (
                    <NavLink
                        to="/logs"
                        className={({ isActive }) =>
                            `${linkBase} ${isActive ? linkActive : ""}`
                        }
                    >
                        <DocumentTextIcon className="h-5 w-5" />
                        Logs
                    </NavLink>
                )}
            </nav>
        </aside>
    );
}
