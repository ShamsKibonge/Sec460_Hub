import { useEffect, useState } from "react";
import { getAllUsers, setUserAdminStatus, setUserActiveStatus } from "../api/users";

export default function Users() {
    const [users, setUsers] = useState([]);
    const [error, setError] = useState(null);
    //new comments
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await getAllUsers();
                setUsers(response.users);
            } catch (err) {
                setError("Failed to fetch users.");
                console.error(err);
            }
        };
        fetchUsers();
    }, []);

    const handleSetAdminStatus = async (userId, isAdmin) => {
        try {
            await setUserAdminStatus(userId, isAdmin);
            setUsers(users.map(user => user.id === userId ? { ...user, isAdmin } : user));
        } catch (err) {
            setError("Failed to update admin status.");
            console.error(err);
        }
    };

    const handleSetActiveStatus = async (userId, isActive) => {
        try {
            await setUserActiveStatus(userId, isActive);
            setUsers(users.map(user => user.id === userId ? { ...user, isActive } : user));
        } catch (err) {
            setError("Failed to update active status.");
            console.error(err);
        }
    };

    if (error) {
        return <div className="p-6 text-red-500">{error}</div>;
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Users</h1>
            <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                    <thead>
                        <tr>
                            <th className="py-2 px-4 border-b">Email</th>
                            <th className="py-2 px-4 border-b">Alias</th>
                            <th className="py-2 px-4 border-b">Is Admin</th>
                            <th className="py-2 px-4 border-b">Is Active</th>
                            <th className="py-2 px-4 border-b">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td className="py-2 px-4 border-b">{user.email}</td>
                                <td className="py-2 px-4 border-b">{user.alias}</td>
                                <td className="py-2 px-4 border-b">{user.isAdmin ? "Yes" : "No"}</td>
                                <td className="py-2 px-4 border-b">{user.isActive ? "Yes" : "No"}</td>
                                <td className="py-2 px-4 border-b">
                                    <button
                                        onClick={() => handleSetAdminStatus(user.id, !user.isAdmin)}
                                        disabled={user.isSuperAdmin}
                                        className={`px-4 py-2 rounded ${user.isAdmin
                                                ? "bg-red-500 hover:bg-red-600"
                                                : "bg-green-500 hover:bg-green-600"
                                            } text-white mr-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {user.isSuperAdmin ? "Super Admin" : (user.isAdmin ? "Remove Admin" : "Make Admin")}
                                    </button>
                                    <button
                                        onClick={() => handleSetActiveStatus(user.id, !user.isActive)}
                                        disabled={user.isSuperAdmin}
                                        className={`px-4 py-2 rounded ${user.isActive
                                                ? "bg-yellow-500 hover:bg-yellow-600"
                                                : "bg-blue-500 hover:bg-blue-600"
                                            } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {user.isActive ? "Deactivate" : "Activate"}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
