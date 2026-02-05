import { useEffect, useMemo, useState } from "react";
import { getLogs } from "../api/logs";

function formatUser(user) {
    if (!user.email) return null;
    return user.alias ? `${user.email} (${user.alias})` : user.email;
}

export default function Logs() {
    const [logs, setLogs] = useState([]);
    const [error, setError] = useState(null);

    // Filter states
    const [activityTypeFilter, setActivityTypeFilter] = useState("");
    const [userFilter, setUserFilter] = useState("");
    const [dateFilter, setDateFilter] = useState("");

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const response = await getLogs();
                setLogs(response.logs);
            } catch (err) {
                setError("Failed to fetch logs.");
                console.error(err);
            }
        };
        fetchLogs();
    }, []);

    const activityTypes = useMemo(() => {
        const types = new Set(logs.map(log => log.activityType));
        return ["", ...Array.from(types)];
    }, [logs]);

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const actor = formatUser({ email: log.actorEmail, alias: log.actorAlias }) || "";
            const target = formatUser({ email: log.targetEmail, alias: log.targetAlias }) || "";

            const userMatch = userFilter.length > 0 ?
                actor.toLowerCase().includes(userFilter.toLowerCase()) ||
                target.toLowerCase().includes(userFilter.toLowerCase()) :
                true;

            const activityMatch = activityTypeFilter ? log.activityType === activityTypeFilter : true;
            
            const dateMatch = dateFilter ? 
                new Date(log.createdAt).toLocaleDateString() === new Date(dateFilter).toLocaleDateString() : 
                true;

            return userMatch && activityMatch && dateMatch;
        });
    }, [logs, activityTypeFilter, userFilter, dateFilter]);

    if (error) {
        return <div className="p-6 text-red-500">{error}</div>;
    }

    const renderDetails = (log) => {
        const targetUser = formatUser({ email: log.targetEmail, alias: log.targetAlias });
        if (targetUser) {
            return `Target: ${targetUser}`;
        }
        if (log.details) {
            return JSON.stringify(log.details);
        }
        return "";
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Activity Logs</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 border rounded-lg bg-gray-50">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Filter by Activity</label>
                    <select
                        value={activityTypeFilter}
                        onChange={(e) => setActivityTypeFilter(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                    >
                        {activityTypes.map(type => (
                            <option key={type} value={type}>{type || "All Activities"}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Filter by User (Email/Alias)</label>
                    <input
                        type="text"
                        value={userFilter}
                        onChange={(e) => setUserFilter(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                        placeholder="Search for user..."
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Filter by Date</label>
                    <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full bg-white text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="py-2 px-4 border-b text-left">Timestamp</th>
                            <th className="py-2 px-4 border-b text-left">User</th>
                            <th className="py-2 px-4 border-b text-left">Activity Type</th>
                            <th className="py-2 px-4 border-b text-left">Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-gray-50">
                                <td className="py-2 px-4 border-b">{new Date(log.createdAt).toLocaleString()}</td>
                                <td className="py-2 px-4 border-b">{formatUser({ email: log.actorEmail, alias: log.actorAlias }) || "System"}</td>
                                <td className="py-2 px-4 border-b font-mono">{log.activityType}</td>
                                <td className="py-2 px-4 border-b font-mono">{renderDetails(log)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
