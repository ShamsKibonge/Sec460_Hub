import { useEffect, useState, useMemo, useRef } from "react";
import { getAllChats, getChatMessages } from "../api/monitor";
import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/solid";

function formatUser(user) {
    if (!user.email) return "Unknown";
    return user.alias ? `${user.email} (${user.alias})` : user.email;
}

function Highlight({ text, highlight }) {
    if (!text) return "";
    if (!highlight) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
        <span>
            {parts.map((part, i) =>
                part.toLowerCase() === highlight.toLowerCase() ? (
                    <mark key={i} className="bg-yellow-300">{part}</mark>
                ) : (
                    part
                )
            )}
        </span>
    );
}

export default function Monitor() {
    const [chats, setChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [error, setError] = useState(null);

    // Search state
    const [searchTerm, setSearchTerm] = useState("");
    const [currentMatch, setCurrentMatch] = useState(0);
    const messageRefs = useRef([]);

    useEffect(() => {
        const fetchChats = async () => {
            try {
                const response = await getAllChats();
                setChats(response.chats);
            } catch (err) {
                setError("Failed to fetch chats.");
                console.error(err);
            }
        };
        fetchChats();
    }, []);

    const matches = useMemo(() => {
        if (!searchTerm) return [];
        return messages.reduce((acc, message, index) => {
            if (message.text && message.text.toLowerCase().includes(searchTerm.toLowerCase())) {
                acc.push(index);
            }
            return acc;
        }, []);
    }, [messages, searchTerm]);

    useEffect(() => {
        if (matches.length > 0 && messageRefs.current[matches[currentMatch]]) {
            messageRefs.current[matches[currentMatch]].scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    }, [currentMatch, matches]);


    const handleSelectChat = async (chat) => {
        setSelectedChat(chat);
        setSearchTerm("");
        setCurrentMatch(0);
        try {
            const response = await getChatMessages(chat.type, chat.id);
            setMessages(response.messages);
        } catch (err) {
            setError(`Failed to fetch messages for ${chat.name}.`);
            console.error(err);
        }
    };

    const goToNextMatch = () => {
        if (matches.length > 0) {
            setCurrentMatch((prev) => (prev + 1) % matches.length);
        }
    };

    const goToPrevMatch = () => {
        if (matches.length > 0) {
            setCurrentMatch((prev) => (prev - 1 + matches.length) % matches.length);
        }
    };


    if (error) {
        return <div className="p-6 text-red-500">{error}</div>;
    }

    return (
        <div className="p-6 flex h-[calc(100vh-3.5rem)]">
            <div className="w-1/3 pr-4 overflow-y-auto">
                <h1 className="text-2xl font-bold mb-4">Monitor</h1>
                <ul>
                    {chats.map((chat) => (
                        <li
                            key={`${chat.type}-${chat.id}`}
                            onClick={() => handleSelectChat(chat)}
                            className={`cursor-pointer p-2 rounded ${selectedChat?.id === chat.id ? "bg-gray-200" : "hover:bg-gray-100"}`}
                        >
                            {chat.name} ({chat.type})
                        </li>
                    ))}
                </ul>
            </div>
            <div className="w-2/3 flex flex-col h-full">
                {selectedChat ? (
                    <>
                        <div className="border-b pb-2 mb-2">
                             <h2 className="text-xl font-bold">Conversation: {selectedChat.name}</h2>
                             <div className="flex items-center gap-2 mt-2">
                                <input
                                    type="text"
                                    placeholder="Search in conversation..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setCurrentMatch(0);
                                    }}
                                    className="w-full rounded-md border-gray-300 shadow-sm text-sm"
                                />
                                {matches.length > 0 && (
                                    <span className="text-sm text-gray-500 whitespace-nowrap">
                                        {currentMatch + 1} of {matches.length}
                                    </span>
                                )}
                                <button onClick={goToPrevMatch} disabled={matches.length === 0} className="p-1 rounded-md hover:bg-gray-100 disabled:opacity-50">
                                    <ChevronUpIcon className="h-5 w-5" />
                                </button>
                                <button onClick={goToNextMatch} disabled={matches.length === 0} className="p-1 rounded-md hover:bg-gray-100 disabled:opacity-50">
                                    <ChevronDownIcon className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        <ul className="overflow-y-auto flex-grow">
                            {messages.map((message, index) => (
                                <li 
                                    key={message.id} 
                                    className={`mb-2 p-2 rounded-lg transition-colors ${matches[currentMatch] === index ? 'bg-blue-100 border border-blue-300' : ''}`}
                                    ref={el => messageRefs.current[index] = el}
                                >
                                    <div className="font-bold text-sm">
                                        {formatUser({ email: message.senderEmail, alias: message.senderAlias })}:
                                    </div>
                                    <div className="text-gray-800 text-sm">
                                        <Highlight text={message.text} highlight={searchTerm} />
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">{new Date(message.createdAt).toLocaleString()}</div>
                                </li>
                            ))}
                        </ul>
                    </>
                ) : (
                    <div className="text-gray-500 flex items-center justify-center h-full">Select a chat to see the conversation.</div>
                )}
            </div>
        </div>
    );
}
