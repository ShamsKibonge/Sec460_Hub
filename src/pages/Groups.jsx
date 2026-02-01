import { useEffect, useMemo, useState } from "react";
import { addMember, createGroup, listMembers, listMyGroups } from "../api/groups";

export default function Groups() {
    const [groups, setGroups] = useState([]);
    const [selectedId, setSelectedId] = useState(null);

    const [loadingGroups, setLoadingGroups] = useState(true);
    const [loadingMembers, setLoadingMembers] = useState(false);

    const [members, setMembers] = useState([]);

    const [newGroupName, setNewGroupName] = useState("");
    const [memberEmail, setMemberEmail] = useState("");

    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");

    const selectedGroup = useMemo(
        () => groups.find((g) => g.id === selectedId) || null,
        [groups, selectedId]
    );

    async function loadGroups() {
        setErr("");
        setMsg("");
        setLoadingGroups(true);
        try {
            const data = await listMyGroups();
            setGroups(data);
            // auto-select first group
            if (!selectedId && data.length) setSelectedId(data[0].id);
        } catch (ex) {
            setErr(ex.message);
        } finally {
            setLoadingGroups(false);
        }
    }

    async function loadMembers(groupId) {
        setErr("");
        setMsg("");
        setLoadingMembers(true);
        try {
            const data = await listMembers(groupId);
            setMembers(data);
        } catch (ex) {
            setErr(ex.message);
            setMembers([]);
        } finally {
            setLoadingMembers(false);
        }
    }

    useEffect(() => {
        loadGroups();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (selectedId) loadMembers(selectedId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId]);

    async function onCreateGroup(e) {
        e.preventDefault();
        setErr("");
        setMsg("");
        try {
            const g = await createGroup(newGroupName);
            setNewGroupName("");
            setMsg(`Group created: ${g.name}`);
            // refresh list
            await loadGroups();
            setSelectedId(g.id);
        } catch (ex) {
            setErr(ex.message);
        }
    }

    async function onAddMember(e) {
        e.preventDefault();
        if (!selectedId) return;
        setErr("");
        setMsg("");
        try {
            await addMember(selectedId, memberEmail);
            setMemberEmail("");
            setMsg("Member added.");
            await loadMembers(selectedId);
        } catch (ex) {
            setErr(ex.message);
        }
    }

    return (
        <div className="p-4">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">Groups</h1>
                    <p className="text-sm text-gray-600">Create groups and manage members.</p>
                </div>
            </div>

            {(msg || err) && (
                <div className="mb-4">
                    {msg && (
                        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
                            {msg}
                        </div>
                    )}
                    {err && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                            {err}
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Left: Group list */}
                <div
                    className={`
                        ${selectedId ? "hidden lg:block" : ""}
                        rounded-2xl border bg-white p-4 shadow-sm
                    `}
                >
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold">My groups</h2>
                        <button
                            onClick={loadGroups}
                            className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"
                        >
                            Refresh
                        </button>
                    </div>

                    {loadingGroups ? (
                        <div className="mt-3 text-sm text-gray-600">Loading…</div>
                    ) : groups.length === 0 ? (
                        <div className="mt-3 text-sm text-gray-600">No groups yet.</div>
                    ) : (
                        <ul className="mt-3 space-y-2">
                            {groups.map((g) => (
                                <li key={g.id}>
                                    <button
                                        onClick={() => setSelectedId(g.id)}
                                        className={`w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-gray-50 ${selectedId === g.id ? "bg-gray-50" : ""
                                            }`}
                                    >
                                        <div className="font-medium">{g.name}</div>
                                        <div className="text-xs text-gray-500">Role: {g.myRole}</div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <form onSubmit={onCreateGroup} className="mt-4 space-y-2">
                        <label className="block text-sm font-medium">Create group</label>
                        <div className="flex flex-wrap gap-2">
                            <input
                                className="flex-1 rounded-lg border px-3 py-2 text-sm"
                                placeholder="e.g. Blue Team"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                            />
                            <button className="w-full rounded-lg bg-black px-4 py-2 text-sm text-white hover:opacity-90 sm:w-auto">
                                Create
                            </button>
                        </div>
                    </form>
                </div>

                {/* Right: Members */}
                <div
                    className={`
                        ${selectedId ? "" : "hidden lg:block"}
                        rounded-2xl border bg-white p-4 shadow-sm lg:col-span-2
                    `}
                >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <button className="lg:hidden" onClick={() => setSelectedId(null)}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                                </svg>
                            </button>
                            <div>
                                <h2 className="font-semibold">
                                    Members{selectedGroup ? ` — ${selectedGroup.name}` : ""}
                                </h2>
                                <p className="text-xs text-gray-500">
                                    Shows alias if available, otherwise email.
                                </p>
                            </div>
                        </div>
                    </div>

                    {!selectedId ? (
                        <div className="mt-3 text-sm text-gray-600">Select a group.</div>
                    ) : loadingMembers ? (
                        <div className="mt-3 text-sm text-gray-600">Loading members…</div>
                    ) : (
                        <div className="mt-3 flow-root">
                            <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                                <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                                    <div className="overflow-hidden rounded-xl border">
                                        <table className="min-w-full divide-y divide-gray-300 text-sm">
                                            <thead className="bg-gray-50 text-left">
                                                <tr>
                                                    <th scope="col" className="px-3 py-2">Name</th>
                                                    <th scope="col" className="px-3 py-2">Email</th>
                                                    <th scope="col" className="px-3 py-2">Role</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 bg-white">
                                                {members.map((m) => (
                                                    <tr key={m.id} className="border-t">
                                                        <td className="whitespace-nowrap px-3 py-2 font-medium">
                                                            {m.alias || "—"}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-2 text-gray-600">{m.email}</td>
                                                        <td className="whitespace-nowrap px-3 py-2">{m.role}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <form onSubmit={onAddMember} className="mt-4 space-y-2">
                        <label className="block text-sm font-medium">Add member (admin only)</label>
                        <div className="flex flex-wrap gap-2">
                            <input
                                className="flex-1 rounded-lg border px-3 py-2 text-sm"
                                placeholder="person@sofkam.com"
                                value={memberEmail}
                                onChange={(e) => setMemberEmail(e.target.value)}
                            />
                            <button className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:opacity-90">
                                Add
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">
                            If the user doesn’t exist yet, we create them with alias = null.
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
}
