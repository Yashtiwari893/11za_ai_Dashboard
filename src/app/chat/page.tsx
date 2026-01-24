"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { v4 as uuid } from "uuid";
import ReactMarkdown from "react-markdown";
import { Bot } from "lucide-react";
import Link from "next/link";

type ChatMessage = {
    role: "user" | "assistant";
    content: string;
};

type FileItem = {
    id: string;
    name: string;
};

export default function ChatPage() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const bottomRef = useRef<HTMLDivElement | null>(null);

    const [files, setFiles] = useState<FileItem[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);

    useEffect(() => {
        async function loadFiles() {
            const res = await fetch("/api/files");
            if (!res.ok) {
                console.error("Failed to load files");
                return;
            }
            const data = await res.json();
            const fetchedFiles: FileItem[] = data.files || [];
            setFiles(fetchedFiles);

            const hadSelection = Boolean(selectedFile);
            let nextSelection = selectedFile;

            if (
                nextSelection &&
                !fetchedFiles.some((f) => f.id === nextSelection)
            ) {
                nextSelection = null;
            }

            if (!hadSelection && !nextSelection && fetchedFiles.length > 0) {
                nextSelection = fetchedFiles[0].id;
            }

            if (nextSelection !== selectedFile) {
                setSelectedFile(nextSelection);
                // Reset chat when file changes
                if (hadSelection) {
                    resetChat();
                }
            }
        }

        loadFiles();
    }, [selectedFile]);


    // Create / load persistent session id
    useEffect(() => {
        let id = localStorage.getItem("chat_session_id");
        if (!id) {
            id = uuid();
            localStorage.setItem("chat_session_id", id);
        }
        setSessionId(id);
    }, []);

    // Load history for this session
    useEffect(() => {
        if (!sessionId) return;

        async function loadHistory() {
            try {
                const res = await fetch(`/api/get-messages?session_id=${sessionId}`);
                if (!res.ok) {
                    console.error("Failed to load history");
                    return;
                }
                const data = await res.json();
                setMessages(data.messages || []);
            } catch (err) {
                console.error("loadHistory error", err);
            }
        }

        loadHistory();
    }, [sessionId]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    async function sendMessage() {
        if (!input.trim() || !sessionId || isSending || !selectedFile) return;

        const content = input.trim();
        const userMessage: ChatMessage = { role: "user", content };

        setIsSending(true);
        setInput("");
        setMessages((prev) => [...prev, userMessage]);

        try {
            // Save user message
            await fetch("/api/save-message", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: sessionId,
                    role: "user",
                    content,
                }),
            });

            // Show thinking indicator
            setIsThinking(true);

            // Call chat API with streaming
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: sessionId,
                    message: content,
                    file_id: selectedFile,  // <-- important
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                console.error("Chat error:", data.error);
                setIsThinking(false);
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        content: "Server error while talking to the model.",
                    },
                ]);
                return;
            }

            // Hide thinking indicator and add streaming message
            setIsThinking(false);

            // Add an empty AI message that we'll update as we stream
            const aiMessageIndex = messages.length + 1;
            setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

            // Handle streaming response
            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            let fullReply = "";

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    fullReply += chunk;

                    // Update the AI message with accumulated content
                    setMessages((prev) => {
                        const updated = [...prev];
                        updated[aiMessageIndex] = {
                            role: "assistant",
                            content: fullReply,
                        };
                        return updated;
                    });
                }
            }

            // Save AI message
            await fetch("/api/save-message", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: sessionId,
                    role: "assistant",
                    content: fullReply,
                }),
            });
        } catch (err) {
            console.error("sendMessage error", err);
            setIsThinking(false);
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: "Something went wrong while sending the message.",
                },
            ]);
        } finally {
            setIsSending(false);
        }
    }

    function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    function resetChat() {
        const newSessionId = uuid();
        localStorage.setItem("chat_session_id", newSessionId);
        setSessionId(newSessionId);
        setMessages([]);
    }

    return (
        <main className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <h1 className="text-xl sm:text-2xl font-bold text-[#0D163F]">AI Chatbot</h1>
                <Button onClick={resetChat} variant="outline" size="sm" className="w-full sm:w-auto">
                    New Chat
                </Button>
            </div>

            <div className="mb-3">
                <label className="text-sm font-medium text-[#0D163F] block mb-2">Select Knowledge Base</label>
                <select
                    className="border border-gray-300 rounded-md p-3 w-full bg-white focus:ring-2 focus:ring-[#09AF72] focus:border-transparent"
                    value={selectedFile ?? ""}
                    onChange={(e) => setSelectedFile(e.target.value)}
                >
                    <option value="">Choose a knowledge base...</option>
                    {files.map((f: FileItem) => (
                        <option key={f.id} value={f.id}>
                            {f.name}
                        </option>
                    ))}
                </select>
            </div>

            {!selectedFile ? (
                <div className="p-6 sm:p-8 text-center text-gray-600 bg-white rounded-lg border border-gray-200">
                    <div className="max-w-md mx-auto">
                        <Bot className="w-12 h-12 mx-auto mb-4 text-[#09AF72]" />
                        <h3 className="text-lg font-semibold mb-2 text-[#0D163F]">No Knowledge Base Selected</h3>
                        <p className="text-sm mb-4">Upload documents on the Knowledge page to start chatting with your AI assistant.</p>
                        <Button asChild className="bg-[#0D163F] hover:bg-[#09AF72] text-white">
                            <Link href="/files">Upload Files</Link>
                        </Button>
                    </div>
                </div>
            ) : (
                <>
                    <ScrollArea className="h-[50vh] sm:h-[60vh] rounded-md border border-gray-200 p-4 bg-white">
                        {messages.map((msg, index) => (
                            <div key={index} className="mb-4">
                                <strong className={`text-sm font-semibold block mb-2 ${
                                    msg.role === "user" ? "text-[#0D163F]" : "text-[#09AF72]"
                                }`}>
                                    {msg.role === "user" ? "You" : "11za AI"}
                                </strong>
                                <div className={`p-3 rounded-lg ${
                                    msg.role === "user"
                                        ? "bg-[#0D163F] text-white ml-0 mr-12"
                                        : "bg-gray-50 text-gray-800 ml-0 mr-0 prose prose-sm max-w-none"
                                }`}>
                                    {msg.role === "assistant" ? (
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    ) : (
                                        <p>{msg.content}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isThinking && (
                            <div className="mb-4">
                                <strong className="text-sm font-semibold text-[#09AF72] block mb-2">11za AI</strong>
                                <div className="p-3 rounded-lg bg-gray-50 ml-0 mr-0">
                                    <div className="flex items-center gap-2 text-gray-500">
                                        <div className="flex gap-1">
                                            <span className="animate-bounce inline-block w-2 h-2 bg-[#09AF72] rounded-full" style={{ animationDelay: '0ms' }}></span>
                                            <span className="animate-bounce inline-block w-2 h-2 bg-[#09AF72] rounded-full" style={{ animationDelay: '150ms' }}></span>
                                            <span className="animate-bounce inline-block w-2 h-2 bg-[#09AF72] rounded-full" style={{ animationDelay: '300ms' }}></span>
                                        </div>
                                        <span className="text-sm">Thinking...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </ScrollArea>

                    <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type your message..."
                            disabled={!selectedFile}
                            className="flex-1"
                        />
                        <Button
                            onClick={sendMessage}
                            disabled={isSending || !input.trim() || !selectedFile}
                            className="bg-[#0D163F] hover:bg-[#09AF72] text-white w-full sm:w-auto"
                        >
                            Send
                        </Button>
                    </div>
                </>
            )}
        </main>
    );
}
