import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { downloadFile, fetchFileBlob } from "../api/files";
import { connectSocket } from "../realtime/socket";

import {
    getInbox,
    getGroupMessages,
    getDirectMessages,
    sendGroupMessage,
    sendDirectMessage,
    markSeen,
} from "../api/messages";

import {
    listGroupFiles,
    listThreadFiles,
    uploadGroupFile,
    uploadThreadFile,
} from "../api/files";

import { useUser } from "../context/UserContext";

export default function Messages() {
    const { user } = useUser();
    // const chatRef = useRef(null);

    const endRef = useRef(null);
    const chatBoxRef = useRef(null);

    const [inbox, setInbox] = useState([]);
    const [selected, setSelected] = useState(null); // {type, id, name, otherUser?}
    const [messages, setMessages] = useState([]);

    const [loadingInbox, setLoadingInbox] = useState(true);
    const [loadingMsgs, setLoadingMsgs] = useState(false);
    const [driveFolderId, setDriveFolderId] = useState(null);

    const [text, setText] = useState("");
    const [err, setErr] = useState("");
    const [msg, setMsg] = useState("");

    // const [files, setFiles] = useState([]);
    // const [loadingFiles, setLoadingFiles] = useState(false);
    // const [fileErr, setFileErr] = useState("");
    const [uploading, setUploading] = useState(false);

    const [drivePath, setDrivePath] = useState([]);

    const [showFiles, setShowFiles] = useState(false);
    const [filesHistory, setFilesHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [historyErr, setHistoryErr] = useState("");
    const [filesHistoryQ, setFilesHistoryQ] = useState("");

    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState("");
    const [previewName, setPreviewName] = useState("");
    const [previewErr, setPreviewErr] = useState("");

    const [previewMime, setPreviewMime] = useState("");

    const audioRef = useRef(null);

    // Play a short notification sound. Tries an audio file at /notify.mp3 then falls back to WebAudio beep.
    async function playNotificationSound() {
        console.log('[Notification] Attempting to play sound...');

        try {
            if (audioRef.current) {
                // try HTMLAudioElement first
                try {
                    audioRef.current.currentTime = 0;
                } catch (_) { }
                console.log('[Notification] Playing audio file...');
                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch(err => {
                        console.log('[Notification] Audio play() rejected:', err.message);
                    });
                }
                return;
            }
        } catch (e) {
            console.log('[Notification] Audio file play failed:', e.message);
        }

        try {
            console.log('[Notification] Falling back to WebAudio beep...');
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) {
                console.log('[Notification] AudioContext not available');
                return;
            }

            const ctx = new AudioCtx();

            // Resume context if suspended (required on some browsers)
            if (ctx.state === 'suspended') {
                console.log('[Notification] AudioContext is suspended, attempting to resume...');
                try {
                    await ctx.resume();
                    console.log('[Notification] AudioContext resumed');
                } catch (resumeErr) {
                    console.log('[Notification] Could not resume AudioContext:', resumeErr.message);
                }
            }

            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g);
            g.connect(ctx.destination);
            o.type = 'sine';
            o.frequency.value = 1000;
            g.gain.setValueAtTime(0.3, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

            o.start(ctx.currentTime);
            o.stop(ctx.currentTime + 0.3);
            console.log('[Notification] WebAudio beep played');
        } catch (e) {
            console.log('[Notification] WebAudio failed:', e.message);
        }
    }

    function showBrowserNotification(title, body) {
        try {
            if (typeof Notification === 'undefined') {
                console.log('[Notification] Notification API not available');
                return;
            }

            if (Notification.permission === 'granted') {
                console.log('[Notification] Showing browser notification:', title);
                const notif = new Notification(title, {
                    body,
                    icon: '/favicon.ico',
                    requireInteraction: true
                });
                // Close after 5 seconds
                setTimeout(() => notif.close?.(), 5000);
            } else {
                console.log('[Notification] Notification permission not granted:', Notification.permission);
            }
        } catch (e) {
            console.log('[Notification] Browser notification error:', e.message);
        }
    }

    const [driveOpen, setDriveOpen] = useState(false);
    const [driveQ, setDriveQ] = useState("");
    const [driveFiles, setDriveFiles] = useState([]);
    const [driveLoading, setDriveLoading] = useState(false);

    const [driveFolders, setDriveFolders] = useState([]);

    // direct compose
    const [toEmail, setToEmail] = useState("");

    const isDirect = selected?.type === "direct";
    const isGroup = selected?.type === "group";
    const [attachingId, setAttachingId] = useState(null);
    const safeMessages = (messages || []).filter(Boolean);


    const title = useMemo(() => {
        if (!selected) return "Messages";
        return selected.name || "Chat";
    }, [selected]);

    const loadInbox = useCallback(async () => {
        setErr("");
        setLoadingInbox(true);
        try {
            const items = await getInbox();
            setInbox(items);
            if (!selected && items.length) setSelected(items[0]);
        } catch (ex) {
            setErr(ex.message);
        } finally {
            setLoadingInbox(false);
        }
    }, [selected]);

    async function loadDriveFiles(nextFolderId = driveFolderId) {
        setDriveLoading(true);
        try {
            const params = new URLSearchParams();
            if (nextFolderId) params.set("folderId", nextFolderId);
            if (driveQ.trim()) params.set("q", driveQ.trim());

            const suffix = params.toString() ? `?${params.toString()}` : "";

            const res = await fetch(`/api/v1/drive/contents${suffix}`, {
                headers: authHeaders(),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to load drive");

            setDriveFolders(data.folders || []);
            setDriveFiles(data.files || []);
            setDrivePath(data.path || []);
        } catch (e) {
            setErr(e.message);
        } finally {
            setDriveLoading(false);
        }
    }


    // async function attachFromDrive(fileId) {
    //     if (!selected) throw new Error("Select a chat first.");

    //     const url =
    //         selected.type === "group"
    //             ? `/api/v1/messages/groups/${selected.id}/attach-file`
    //             : `/api/v1/messages/threads/${selected.id}/attach-file`;

    //     const res = await fetch(url, {
    //         method: "POST",
    //         headers: { ...authHeaders(), "Content-Type": "application/json" },
    //         body: JSON.stringify({ fileId }),
    //     });

    //     const data = await res.json();
    //     if (!res.ok) throw new Error(data.error || "Attach failed");

    //     await loadInbox();
    //     return data;
    // }

    async function attachFromDrive(fileId) {
        if (!selected) throw new Error("Select a chat first.");

        const url =
            selected.type === "group"
                ? `/api/v1/messages/groups/${selected.id}/attach-file`
                : `/api/v1/messages/threads/${selected.id}/attach-file`;

        const res = await fetch(url, {
            method: "POST",
            headers: { ...authHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ fileId }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Attach failed");

        // ✅ if we are inside this chat, append immediately
        if (data?.message?.id) {
            setMessages((prev) => (prev.some((m) => m?.id === data.message.id) ? prev : [...prev, data.message]));
        }

        // ✅ always refresh inbox (order + preview + unread)
        await loadInbox();

        return data;
    }




    const loadMessages = useCallback(async (item) => {
        if (!item) return;
        setErr("");
        setMsg("");
        setLoadingMsgs(true);
        try {
            let data = [];
            if (item.type === "group") data = await getGroupMessages(item.id);
            if (item.type === "direct") data = await getDirectMessages(item.id);

            setMessages(data);

            // ✅ mark as read when opening the chat
            await markSeen(item.type, item.id);
            await loadInbox();
        } catch (ex) {
            setErr(ex.message);
            setMessages([]);
        } finally {
            setLoadingMsgs(false);
        }
    }, [loadInbox]);


    async function onPreview(fileId, originalName, mimeType) {
        setPreviewErr("");
        try {
            const blob = await fetchFileBlob(fileId);
            const url = URL.createObjectURL(blob);

            setPreviewUrl(url);
            setPreviewName(originalName || "Preview");
            setPreviewMime(mimeType || "");
            setPreviewOpen(true);
        } catch (ex) {
            setPreviewErr(ex.message);
        }
    }

    function closePreview() {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl("");
        setPreviewName("");
        setPreviewMime("");
        setPreviewOpen(false);
    }

    function authHeaders() {
        const token = localStorage.getItem("portal_token");
        return {
            Authorization: `Bearer ${token}`,
        };
    }


    async function onDownload(fileId, originalName) {
        try {
            const blob = await downloadFile(fileId);

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = originalName || "download";
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (ex) {
            // setFileErr(ex.message);
            console.error("Download failed:", ex); // It's good practice to log the error
        }
    }

    async function openFilesHistory() {
        if (!selected) return;

        setShowFiles(true);
        setHistoryErr("");
        setLoadingHistory(true);

        try {
            let data = [];
            if (selected.type === "group") data = await listGroupFiles(selected.id);
            if (selected.type === "direct") data = await listThreadFiles(selected.id);
            setFilesHistory(data);
        } catch (ex) {
            setHistoryErr(ex.message);
            setFilesHistory([]);
        } finally {
            setLoadingHistory(false);
        }
    }

    // function pushUniqueMessage(newMsg) {
    //     if (!newMsg?.id) return;
    //     setMessages((prev) => (prev.some((m) => m?.id === newMsg.id) ? prev : [...prev, newMsg]));
    // }

    // function sameChat(selected, payload) {
    //     if (!selected) return false;
    //     if (payload.scope === "group") return selected.type === "group" && selected.id === payload.groupId;
    //     if (payload.scope === "direct") return selected.type === "direct" && selected.id === payload.threadId;
    //     return false;
    // }

    // function inboxPreviewFromMessage(m) {
    //     if (!m) return "";
    //     if (m.kind === "file") return `📎 ${m.file?.originalName || "File"}`;
    //     return m.text || "";
    // }

    // function bumpInbox(payload) {
    //     const msg = payload.message;
    //     const id = payload.scope === "group" ? payload.groupId : payload.threadId;

    //     setInbox((prev) => {
    //         const idx = prev.findIndex((x) => x.type === payload.scope && x.id === id);
    //         if (idx === -1) return prev; // if the chat isn't in inbox yet, keep as-is (or call loadInbox)

    //         const item = prev[idx];

    //         const active = sameChat(selected, payload);

    //         const updated = {
    //             ...item,
    //             lastMessageText: inboxPreviewFromMessage(msg),
    //             lastMessageAt: msg.createdAt,
    //             unreadCount: active ? 0 : (Number(item.unreadCount || 0) + 1),
    //         };

    //         const rest = prev.filter((_, i) => i !== idx);
    //         return [updated, ...rest]; // ✅ move to top
    //     });
    // }
    // function messagePreview(m) {
    //     if (!m) return "";
    //     if (m.kind === "file") return `📎 ${m.file?.originalName || "File"}`;
    //     return m.text || "";
    // }

    // function bumpInboxItem(prev, matcherFn, patchFn) {
    //     const idx = prev.findIndex(matcherFn);
    //     if (idx === -1) return prev;

    //     const updated = patchFn(prev[idx]);
    //     const next = [...prev.slice(0, idx), ...prev.slice(idx + 1)];
    //     return [updated, ...next]; // move to top
    // }




    useEffect(() => {
        loadInbox();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        loadMessages(selected);
    }, [selected, loadMessages]);

    // useEffect(() => {
    //     const s = connectSocket();
    //     if (!s) return;

    //     const handler = (payload) => {
    //         loadInbox();

    //         if (payload.scope === "group") {
    //             if (selected?.type === "group" && selected.id === payload.groupId) {
    //                 pushUniqueMessage(payload.message);
    //                 markSeen("group", payload.groupId).catch(() => { });
    //             }
    //             loadInbox();
    //         }

    //         if (payload.scope === "direct") {
    //             if (selected?.type === "direct" && selected.id === payload.threadId) {
    //                 pushUniqueMessage(payload.message);
    //                 markSeen("direct", payload.threadId).catch(() => { });
    //             }
    //             loadInbox();
    //         }
    //     };

    //     s.on("message:new", handler);
    //     return () => s.off("message:new", handler);
    // }, [selected?.type, selected?.id]);


    useEffect(() => {
        const s = connectSocket();
        if (!s) return;

        const onInboxUpdate = () => {
            loadInbox(); // reorder + unread badge
        };

        // debug socket connection state
        try {
            if (!s) {
                console.log('[Notification] Socket not initialized (no token or not connected)');
            } else {
                console.log('[Notification] Socket object:', { id: s.id, connected: s.connected });
                s.on('connect', () => console.log('[Notification] socket connected:', s.id));
                s.on('disconnect', (reason) => console.log('[Notification] socket disconnected:', reason));
                s.on('connect_error', (err) => console.log('[Notification] socket connect_error (client):', err?.message || err));
            }
        } catch (e) {
            console.log('[Notification] Error inspecting socket:', e);
        }

        const onNewMessage = (payload) => {
            console.log('[Notification] Message received:', payload);
            // only append if you're INSIDE that same chat
            if (payload.scope === "group") {
                if (selected?.type === "group" && selected.id === payload.groupId) {
                    setMessages((prev) =>
                        prev.some((x) => x?.id === payload.message.id) ? prev : [...prev, payload.message]
                    );
                    markSeen("group", payload.groupId).catch(() => { });
                }
            }

            if (payload.scope === "direct") {
                if (selected?.type === "direct" && selected.id === payload.threadId) {
                    setMessages((prev) =>
                        prev.some((x) => x?.id === payload.message.id) ? prev : [...prev, payload.message]
                    );
                    markSeen("direct", payload.threadId).catch(() => { });
                }
            }

            // Play sound / show notification when message is from someone else and
            // either you're not inside that chat or the window is not focused.
            try {
                const isFromMe = payload.message?.sender?.id === user?.id;
                const inSameChat = (payload.scope === 'group' && selected?.type === 'group' && selected?.id === payload.groupId) ||
                    (payload.scope === 'direct' && selected?.type === 'direct' && selected?.id === payload.threadId);

                console.log('[Notification] Checking notification:', { isFromMe, inSameChat, hidden: document.hidden });

                if (!isFromMe && (!inSameChat || document.hidden)) {
                    console.log('[Notification] Triggering notification...');
                    const preview = payload.message?.kind === 'file' ? `📎 ${payload.message?.file?.originalName || 'File'}` : (payload.message?.text || 'New message');
                    playNotificationSound();
                    showBrowserNotification(payload.message?.sender?.alias || payload.message?.sender?.email || 'New message', preview);
                }
            } catch (e) {
                console.log('[Notification] Error in notification logic:', e);
            }
        };

        // prepare audio element if file exists (optional)
        try {
            const a = new Audio('/notify.mp3');
            a.preload = 'auto';
            a.crossOrigin = 'anonymous';
            a.volume = 1;
            a.onerror = (e) => {
                console.log('[Notification] Audio file /notify.mp3 error:', a.error?.code, e);
                audioRef.current = null;
            };
            a.oncanplay = () => {
                console.log('[Notification] Audio file loaded successfully');
            };
            a.onloadeddata = () => {
                console.log('[Notification] Audio data loaded');
            };
            audioRef.current = a;
            console.log('[Notification] Audio element created, attempting to load /notify.mp3');
        } catch (e) {
            console.log('[Notification] Audio initialization error:', e.message);
            audioRef.current = null;
        }

        // request notification permission - MUST happen after user interaction on https
        try {
            console.log('[Notification] Current permission state:', Notification.permission);
            if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
                console.log('[Notification] Requesting notification permission...');
                Notification.requestPermission().then(result => {
                    console.log('[Notification] Permission result:', result);
                    console.log('[Notification] New permission state:', Notification.permission);
                }).catch((err) => {
                    console.log('[Notification] Permission request failed:', err);
                });
            } else if (Notification.permission === 'granted') {
                console.log('[Notification] Notification permission already granted');
            } else {
                console.log('[Notification] Notification permission denied or unavailable');
            }
        } catch (e) {
            console.log('[Notification] Permission check error:', e.message);
        }

        s.on("inbox:update", onInboxUpdate);
        s.on("message:new", onNewMessage);

        return () => {
            s.off("inbox:update", onInboxUpdate);
            s.off("message:new", onNewMessage);
        };
    }, [selected, loadInbox, user?.id]);




    // useEffect(() => {
    //     const s = connectSocket();
    //     if (!s) return;
    //     const onInboxUpdate = () => {
    //         loadInbox(); // this will reorder + refresh unreadCount using backend logic
    //     };


    //     const handler = async (payload) => {
    //         // 1) update messages if user is inside that chat
    //         const inSameChat =
    //             (payload.scope === "group" &&
    //                 selected?.type === "group" &&
    //                 selected.id === payload.groupId) ||
    //             (payload.scope === "direct" &&
    //                 selected?.type === "direct" &&
    //                 selected.id === payload.threadId);

    //         if (inSameChat) {
    //             setMessages((prev) =>
    //                 prev.some((x) => x.id === payload.message?.id) ? prev : [...prev, payload.message]
    //             );

    //             // mark seen (and locally reset unread)
    //             try {
    //                 if (payload.scope === "group") await markSeen("group", payload.groupId);
    //                 if (payload.scope === "direct") await markSeen("direct", payload.threadId);
    //             } catch { }
    //         }

    //         // 2) ALWAYS update inbox instantly (move to top + preview + time + unread)
    //         setInbox((prev) => {
    //             const msg = payload.message;
    //             const at = msg?.createdAt || new Date().toISOString();
    //             const preview = messagePreview(msg);

    //             if (payload.scope === "group") {
    //                 return bumpInboxItem(
    //                     prev,
    //                     (it) => it.type === "group" && it.id === payload.groupId,
    //                     (it) => ({
    //                         ...it,
    //                         lastMessageText: preview,
    //                         lastMessageAt: at,
    //                         unreadCount: inSameChat ? 0 : (it.unreadCount || 0) + 1,
    //                     })
    //                 );
    //             }

    //             if (payload.scope === "direct") {
    //                 return bumpInboxItem(
    //                     prev,
    //                     (it) => it.type === "direct" && it.id === payload.threadId,
    //                     (it) => ({
    //                         ...it,
    //                         lastMessageText: preview,
    //                         lastMessageAt: at,
    //                         unreadCount: inSameChat ? 0 : (it.unreadCount || 0) + 1,
    //                     })
    //                 );
    //             }

    //             return prev;
    //         });
    //     };
    //     s.on("inbox:update", onInboxUpdate);
    //     s.on("message:new", handler);

    //     return () => { s.off("message:new", handler); s.off("inbox:update", onInboxUpdate); }
    // }, [selected?.type, selected?.id]);



    // useEffect(() => {
    //     const s = connectSocket();
    //     if (!s) return;

    //     if (selected?.type && selected?.id) {
    //         s.emit("chat:join", { type: selected.type, id: selected.id });
    //         return () => s.emit("chat:leave", { type: selected.type, id: selected.id });
    //     }
    // }, [selected?.type, selected?.id]);

    useEffect(() => {
        const s = connectSocket();
        if (!s || !selected) return;

        s.emit("chat:join", { type: selected.type, id: selected.id });

        return () => {
            s.emit("chat:leave", { type: selected.type, id: selected.id });
        };
    }, [selected]);



    // async function onSend(e) {
    //     e.preventDefault();
    //     const t = text.trim();
    //     if (!t) return;

    //     setErr("");
    //     setMsg("");

    //     try {
    //         if (isGroup) {
    //             const newMsg = await sendGroupMessage(selected.id, t);
    //             setMessages((prev) => [...prev, newMsg]);
    //         } else if (isDirect) {
    //             // when already inside a thread, we need the other person's email to send
    //             // easiest for now: use the otherUser email from inbox item if present
    //             const email = selected.otherUser?.email;
    //             if (!email) throw new Error("Missing recipient email for this direct thread.");
    //             const res = await sendDirectMessage(email, t);
    //             setMessages((prev) => [...prev, res.message]);
    //         } else {
    //             throw new Error("Select a group or a direct chat first.");
    //         }

    //         setText("");
    //     } catch (ex) {
    //         setErr(ex.message);
    //     }
    // }

    async function onSend(e) {
        e.preventDefault();
        const t = text.trim();
        if (!t) return;

        setErr("");
        setMsg("");

        try {
            if (isGroup) {
                const newMsg = await sendGroupMessage(selected.id, t); // ✅ message object
                setMessages((prev) => [...prev, newMsg]);
                await loadInbox();
            } else if (isDirect) {
                const email = selected.otherUser?.email;
                if (!email) throw new Error("Missing recipient email for this direct thread.");
                await sendDirectMessage(email, t);
            } else {
                throw new Error("Select a group or a direct chat first.");
            }

            setText("");
            // ✅ don't setMessages here; socket will append
        } catch (ex) {
            setErr(ex.message);
        }
    }

    // async function loadFiles(item) {
    //     if (!item) return;
    //     setFileErr("");
    //     setLoadingFiles(true);

    //     try {
    //         let data = [];
    //         if (item.type === "group") data = await listGroupFiles(item.id);
    //         if (item.type === "direct") data = await listThreadFiles(item.id);
    //         setFiles(data);
    //     } catch (ex) {
    //         setFileErr(ex.message);
    //         setFiles([]);
    //     } finally {
    //         setLoadingFiles(false);
    //     }
    // }

    // useEffect(() => {
    //     loadFiles(selected);
    //     // eslint-disable-next-line react-hooks/exhaustive-deps
    // }, [selected?.type, selected?.id]);

    async function onUpload(e) {
        const file = e.target.files?.[0];
        if (!file || !selected) return;

        // setFileErr("");
        setUploading(true);

        try {
            if (selected.type === "group") {
                await uploadGroupFile(selected.id, file);
            } else if (selected.type === "direct") {
                await uploadThreadFile(selected.id, file);
            }

            // await loadFiles(selected); // refresh list
            e.target.value = ""; // reset input so same file can be selected again
        } catch (ex) {
            // setFileErr(ex.message);
        } finally {
            setUploading(false);
        }
    }


    useLayoutEffect(() => {
        const el = chatBoxRef.current;
        if (!el) return;

        // scroll to bottom
        el.scrollTop = el.scrollHeight;
    }, [selected?.type, selected?.id, messages.length]);

    useEffect(() => {
        // Wait for DOM paint so the last message exists
        const t = setTimeout(() => {
            endRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 0);

        return () => clearTimeout(t);
    }, [selected?.type, selected?.id, messages.length]);

    async function onStartDirect(e) {
        e.preventDefault();
        const email = toEmail.trim().toLowerCase();
        if (!email) return;

        setErr("");
        setMsg("");

        try {
            const res = await sendDirectMessage(email, "👋"); // you can change to "Hi"
            setMsg("Direct chat started.");
            setToEmail("");
            await loadInbox(); // so the thread appears
            // select the thread
            setSelected({ type: "direct", id: res.threadId, name: email, otherUser: { email } });
        } catch (ex) {
            setErr(ex.message);
        }
    }



    function scrollToBottom(behavior = "auto") {
        const el = chatBoxRef.current;
        if (!el) return;
        el.scrollTo({ top: el.scrollHeight, behavior });
    }

    // when you switch chats OR messages finish loading
    useLayoutEffect(() => {
        if (loadingMsgs) return;
        scrollToBottom("auto");
    }, [selected?.type, selected?.id, loadingMsgs]);

    // when a new message is added in the current chat
    useEffect(() => {
        if (loadingMsgs) return;
        scrollToBottom("smooth");
    }, [messages.length, loadingMsgs]);


    return (
        <div className="p-4">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">{title}</h1>
                    <p className="text-sm text-gray-600">
                        Logged in as <b>{user?.alias || user?.email}</b>
                    </p>
                </div>
                <button
                    onClick={loadInbox}
                    className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                >
                    Refresh
                </button>
            </div>

            {(msg || err) && (
                <div className="mb-4 space-y-2">
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
                {/* Inbox */}
                <div
                    className={`
                        ${selected ? "hidden lg:block" : ""}
                        rounded-2xl border bg-white p-4 shadow-sm
                    `}
                >
                    <h2 className="font-semibold">Inbox</h2>

                    <form onSubmit={onStartDirect} className="mt-3 space-y-2">
                        <label className="block text-sm font-medium">Start direct chat</label>
                        <div className="flex flex-wrap gap-2">
                            <input
                                className="flex-1 rounded-lg border px-3 py-2 text-sm"
                                placeholder="person@example.com"
                                value={toEmail}
                                onChange={(e) => setToEmail(e.target.value)}
                            />
                            <button className="rounded-lg bg-black px-3 py-2 text-sm text-white hover:opacity-90">
                                Start
                            </button>
                        </div>
                    </form>

                    {loadingInbox ? (
                        <div className="mt-3 text-sm text-gray-600">Loading…</div>
                    ) : (
                        <ul className="mt-4 space-y-2">
                            {inbox.map((item) => (
                                <li key={`${item.type}:${item.id}`}>
                                    <button
                                        onClick={() => setSelected(item)}
                                        className={`w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-gray-50 ${selected?.id === item.id && selected?.type === item.type
                                            ? "bg-gray-50"
                                            : ""
                                            }`}
                                    >
                                        <div className="text-xs uppercase text-gray-500">{item.type}</div>
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="truncate font-medium">{item.name}</div>

                                            {!!item.unreadCount && (
                                                <div className="min-w-[24px] rounded-full bg-black px-2 py-0.5 text-center text-xs text-white">
                                                    {item.unreadCount}
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-1 truncate text-xs text-gray-500">
                                            {item.lastMessageText ? item.lastMessageText : "No messages yet"}
                                        </div>

                                        {item.lastMessageAt && (
                                            <div className="mt-1 text-[11px] text-gray-400">
                                                {new Date(item.lastMessageAt).toLocaleString()}
                                            </div>
                                        )}
                                    </button>
                                </li>
                            ))}
                            {inbox.length === 0 && (
                                <div className="mt-3 text-sm text-gray-600">No chats yet.</div>
                            )}
                        </ul>
                    )}
                </div>

                {/* Chat */}
                <div
                    className={`
                        ${selected ? "" : "hidden lg:block"}
                        rounded-2xl border bg-white p-4 shadow-sm lg:col-span-2
                    `}
                >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <button className="lg:hidden" onClick={() => setSelected(null)}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                                </svg>
                            </button>

                            <h2 className="font-semibold">Chat</h2>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={openFilesHistory}
                                disabled={!selected}
                                className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-40"
                            >
                                Files
                            </button>

                            <label className={`${!selected ? "opacity-50" : ""}`}>
                                <input
                                    type="file"
                                    onChange={onUpload}
                                    disabled={!selected || uploading}
                                    className="hidden"
                                />
                                <span className="cursor-pointer rounded-lg bg-black px-3 py-2 text-sm text-white hover:opacity-90">
                                    {uploading ? "Uploading..." : "Upload"}
                                </span>
                            </label>
                        </div>
                    </div>

                    {loadingMsgs ? (
                        <div className="mt-3 text-sm text-gray-600">Loading messages…</div>
                    ) : (
                        <div
                            ref={chatBoxRef}
                            className="mt-3 h-[420px] overflow-auto rounded-xl border bg-gray-50 p-3"
                        >
                            {messages.length === 0 ? (
                                <div className="text-sm text-gray-600">No messages yet.</div>
                            ) : (
                                <div className="space-y-2">
                                    {safeMessages.map((m) => {
                                        const mine = (m.sender?.id || "") === (user?.id || "");
                                        const senderName = mine
                                            ? "You"
                                            : m.sender?.alias || m.sender?.email || "Unknown";

                                        const mime = m.file?.mimeType || "";
                                        const isPreviewable =
                                            mime.startsWith("image/") || mime === "application/pdf";

                                        // ===== FILE MESSAGE =====
                                        if (m.kind === "file" && m.file) {
                                            return (
                                                <div
                                                    key={m.id}
                                                    className={`flex ${mine ? "justify-end" : "justify-start"
                                                        }`}
                                                >
                                                    <div className="max-w-[80%] rounded-xl border bg-white px-3 py-2 text-sm">
                                                        <div
                                                            className={`text-xs ${mine
                                                                ? "text-right text-gray-500"
                                                                : "text-gray-500"
                                                                }`}
                                                        >
                                                            {senderName}
                                                        </div>

                                                        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className="truncate font-medium">
                                                                    📎 {m.file.originalName}
                                                                </div>
                                                                <div className="text-xs text-gray-500">
                                                                    {(m.file.size / 1024).toFixed(1)} KB
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-col gap-2">
                                                                {isPreviewable && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            onPreview(
                                                                                m.file.id,
                                                                                m.file.originalName,
                                                                                m.file.mimeType
                                                                            )
                                                                        }
                                                                        className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                                                                    >
                                                                        Preview
                                                                    </button>
                                                                )}

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        onDownload(m.file.id, m.file.originalName)
                                                                    }
                                                                    className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                                                                >
                                                                    Download
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div
                                                            className={`mt-1 text-[11px] text-gray-400 ${mine ? "text-right" : ""
                                                                }`}
                                                        >
                                                            {new Date(m.createdAt).toLocaleString()}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // ===== TEXT MESSAGE =====
                                        if (m.kind === "text" && m.text) {
                                            return (
                                                <div
                                                    key={m.id}
                                                    className={`flex ${mine ? "justify-end" : "justify-start"
                                                        }`}
                                                >
                                                    <div className="max-w-[80%] rounded-xl border bg-white px-3 py-2 text-sm">
                                                        <div
                                                            className={`text-xs ${mine
                                                                ? "text-right text-gray-500"
                                                                : "text-gray-500"
                                                                }`}
                                                        >
                                                            {senderName}
                                                        </div>

                                                        <div className={mine ? "text-right" : ""}>{m.text}</div>

                                                        <div
                                                            className={`mt-1 text-[11px] text-gray-400 ${mine ? "text-right" : ""
                                                                }`}
                                                        >
                                                            {new Date(m.createdAt).toLocaleString()}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return null;
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                    <form onSubmit={onSend} className="mt-3 flex flex-wrap gap-2">
                        <input
                            className="flex-1 rounded-lg border px-3 py-2 text-sm"
                            placeholder={selected ? "Type a message..." : "Select a chat first..."}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            disabled={!selected}
                        />
                        <button
                            className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-40"
                            disabled={!selected}
                        >
                            Send
                        </button>

                        <button
                            type="button"
                            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                            disabled={!selected}
                            onClick={() => {
                                setDriveOpen(true);
                                setDriveQ("");
                                setDriveFolderId(null);
                                setDriveFolders([]);
                                setDriveFiles([]);
                                setTimeout(() => loadDriveFiles(null), 0);
                            }}
                        >
                            Attach from Drive
                        </button>
                    </form>
                </div>
            </div>
            {showFiles && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b p-4">
                            <div>
                                <div className="text-lg font-semibold">Files history</div>
                                <div className="text-sm text-gray-500">
                                    {selected?.name || "Chat"}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowFiles(false)}
                                className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                            >
                                Close
                            </button>
                        </div>

                        <div className="max-h-[70vh] overflow-auto p-4">
                            {historyErr && (
                                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                                    {historyErr}
                                </div>
                            )}

                            <div className="mb-3">
                                <input
                                    type="text"
                                    className="w-full rounded-lg border px-3 py-2 text-sm"
                                    placeholder="Search files history..."
                                    value={filesHistoryQ}
                                    onChange={(e) => setFilesHistoryQ(e.target.value)}
                                />
                            </div>

                            {loadingHistory ? (
                                <div className="text-sm text-gray-600">Loading files…</div>
                            ) : filesHistory.length === 0 ? (
                                <div className="text-sm text-gray-600">No files yet.</div>
                            ) : (
                                <ul className="space-y-2">
                                    {filesHistory
                                        .filter((f) =>
                                            f.originalName
                                                .toLowerCase()
                                                .includes(filesHistoryQ.toLowerCase())
                                        )
                                        .map((f) => (
                                            <li
                                                key={f.id}
                                                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                                            >
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-medium">
                                                        📎 {f.originalName}
                                                    </div>

                                                    <div className="text-xs text-gray-500">
                                                        {(f.uploader?.alias || f.uploader?.email || "Unknown")} •{" "}
                                                        {(f.size / 1024).toFixed(1)} KB
                                                    </div>

                                                    <div className="text-[11px] text-gray-400">
                                                        Shared: {new Date(f.sharedAt || f.createdAt).toLocaleString()}
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-2">
                                                    {((f.mimeType || "").startsWith("image/") || f.mimeType === "application/pdf") && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onPreview(f.id, f.originalName, f.mimeType)}
                                                            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                                                        >
                                                            Preview
                                                        </button>
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={() => onDownload(f.id, f.originalName)}
                                                        className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                                                    >
                                                        Download
                                                    </button>
                                                </div>

                                            </li>
                                        ))}
                                </ul>
                            )}
                        </div>                    </div>
                </div>
            )}

            {previewOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b p-4">
                            <div className="min-w-0">
                                <div className="truncate text-lg font-semibold">{previewName}</div>
                                <div className="text-sm text-gray-500">Preview</div>
                            </div>

                            <button
                                type="button"
                                onClick={closePreview}
                                className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                            >
                                Close
                            </button>
                        </div>

                        <div className="p-4">
                            {previewErr && (
                                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                                    {previewErr}
                                </div>
                            )}

                            {previewUrl ? (
                                previewMime.startsWith("image/") ? (
                                    <img
                                        src={previewUrl}
                                        alt={previewName}
                                        className="max-h-[70vh] w-full object-contain"
                                    />
                                ) : previewMime === "application/pdf" ? (
                                    <iframe
                                        title={previewName}
                                        src={previewUrl}
                                        className="h-[70vh] w-full rounded-lg border"
                                    />
                                ) : (
                                    <div className="text-sm text-gray-600">
                                        No preview for this file type yet. Please download it.
                                    </div>
                                )
                            ) : (
                                <div className="text-sm text-gray-600">Loading preview…</div>
                            )}

                        </div>
                    </div>
                </div>
            )}

            {driveOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-lg">
                        {/* Header */}
                        <div className="mb-3 flex items-center justify-between gap-2">
                            <div className="font-semibold">Attach from Drive</div>
                            <button
                                className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                                onClick={() => setDriveOpen(false)}
                            >
                                Close
                            </button>
                        </div>

                        {/* Breadcrumbs */}
                        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                            <button
                                className="rounded-lg border px-2 py-1 hover:bg-gray-50"
                                onClick={() => {
                                    setDriveFolderId(null);
                                    loadDriveFiles(null);
                                }}
                            >
                                Root
                            </button>

                            {driveFolderId && (
                                <button
                                    className="rounded-lg border px-2 py-1 hover:bg-gray-50"
                                    onClick={() => {
                                        // go to parent folder using path
                                        const parent = drivePath?.length >= 2 ? drivePath[drivePath.length - 2] : null;
                                        const parentId = parent?.id || null;

                                        setDriveFolderId(parentId);
                                        loadDriveFiles(parentId);
                                    }}
                                >
                                    Back
                                </button>
                            )}

                        </div>

                        {/* Search */}
                        <div className="mb-3 flex gap-2">
                            <input
                                className="flex-1 rounded-lg border px-3 py-2 text-sm"
                                placeholder="Search in this folder…"
                                value={driveQ}
                                onChange={(e) => setDriveQ(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && loadDriveFiles()}
                            />
                            <button
                                className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                                onClick={() => loadDriveFiles()}
                            >
                                Search
                            </button>
                            <button
                                className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                                onClick={() => {
                                    setDriveQ("");
                                    // reload current folder with cleared query
                                    setTimeout(() => loadDriveFiles(driveFolderId), 0);
                                }}
                            >
                                Clear
                            </button>
                        </div>

                        {driveLoading ? (
                            <div className="text-sm text-gray-600">Loading…</div>
                        ) : (
                            <div className="max-h-[60vh] overflow-auto rounded-xl border bg-gray-50 p-3 space-y-4">
                                {/* Folders */}
                                <div>
                                    <div className="text-xs font-semibold text-gray-600">FOLDERS</div>
                                    {driveFolders.length === 0 ? (
                                        <div className="mt-2 text-sm text-gray-600">No folders.</div>
                                    ) : (
                                        <ul className="mt-2 space-y-2">
                                            {driveFolders.map((folder) => (
                                                <li key={folder.id}>
                                                    <button
                                                        className="w-full rounded-lg border bg-white px-3 py-2 text-left text-sm hover:bg-gray-50"
                                                        onClick={() => {
                                                            setDriveFolderId(folder.id);
                                                            loadDriveFiles(folder.id);
                                                        }}
                                                    >
                                                        📁 {folder.name}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                {/* Files */}
                                <div>
                                    <div className="text-xs font-semibold text-gray-600">FILES</div>
                                    {driveFiles.length === 0 ? (
                                        <div className="mt-2 text-sm text-gray-600">No files found.</div>
                                    ) : (
                                        <ul className="mt-2 space-y-2">
                                            {driveFiles.map((file) => (
                                                <li
                                                    key={file.id}
                                                    className="flex items-center justify-between gap-3 rounded-lg border bg-white p-3 text-sm"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="truncate font-medium">📄 {file.originalName}</div>
                                                        <div className="text-xs text-gray-500">
                                                            {(file.size / 1024).toFixed(1)} KB •
                                                            {/* {file.mimeType} */}
                                                        </div>
                                                    </div>

                                                    <button
                                                        disabled={attachingId === file.id}
                                                        className="rounded-lg bg-black px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-40"
                                                        onClick={async () => {
                                                            if (attachingId) return;
                                                            setAttachingId(file.id);
                                                            try {
                                                                await attachFromDrive(file.id);
                                                                setDriveOpen(false);
                                                            } catch (e) {
                                                                setErr(e.message);
                                                            } finally {
                                                                setAttachingId(null);
                                                            }
                                                        }}
                                                    >
                                                        {attachingId === file.id ? "Attaching..." : "Attach"}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}


        </div>
    );
}
