import { useEffect, useRef, useState } from "react";
import * as api from "../api/client";
import Spinner from "../components/Spinner";
import type { ChatMessage, ChatSource, VectorStore } from "../types";

function SourcesPanel({ sources }: { sources: ChatSource[] }) {
  const [open, setOpen] = useState(false);
  if (sources.length === 0) return null;
  return (
    <div className="mt-2 text-xs">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-indigo-600 hover:underline font-medium"
      >
        {open ? "▲ Hide sources" : `▼ Show ${sources.length} source${sources.length !== 1 ? "s" : ""}`}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {sources.map((s, i) => (
            <div key={i} className="rounded-md bg-gray-50 border border-gray-200 p-2">
              <p className="font-semibold text-gray-700 mb-1">{s.filename}</p>
              <p className="text-gray-600 whitespace-pre-wrap">{s.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-lg px-4 py-2.5 text-sm ${
          isUser ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-800"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {!isUser && message.sources && <SourcesPanel sources={message.sources} />}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [stores, setStores] = useState<VectorStore[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await api.getStores();
        setStores(data);
      } catch (err) {
        setError(String(err));
      } finally {
        setStoresLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || !selectedStoreId || streaming) return;

    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setInput("");
    setStreaming(true);
    setError(null);

    // Add placeholder assistant message
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const stream = api.chatStream(selectedStoreId, userMessage.content, messages);
      const reader = stream.getReader();
      let assistantText = "";
      let sources: ChatSource[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value === "[DONE]") continue;

        // Check if it's a sources payload
        try {
          const parsed = JSON.parse(value) as { sources?: ChatSource[] };
          if (parsed.sources) {
            sources = parsed.sources;
            continue;
          }
        } catch {
          // Not JSON — it's a token
        }

        assistantText += value;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: assistantText };
          return updated;
        });
      }

      // Finalize with sources
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: assistantText, sources };
        return updated;
      });
    } catch (err) {
      setError(String(err));
      // Remove the empty assistant placeholder on error
      setMessages((prev) => prev.filter((m, i) => !(i === prev.length - 1 && m.content === "")));
    } finally {
      setStreaming(false);
    }
  }

  const selectedStore = stores.find((s) => s.id === selectedStoreId);

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-gray-800 mb-3">Chat</h1>
        <div className="flex items-center gap-3">
          <label htmlFor="store-select" className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Vector Store:
          </label>
          {storesLoading ? (
            <Spinner />
          ) : (
            <select
              id="store-select"
              value={selectedStoreId}
              onChange={(e) => {
                setSelectedStoreId(e.target.value);
                setMessages([]);
              }}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">— Select a store —</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.document_count} doc{s.document_count !== 1 ? "s" : ""})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
        {!selectedStoreId ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
            <p className="text-4xl mb-3">💬</p>
            <p className="text-lg font-medium text-gray-500">No store selected</p>
            <p className="text-sm mt-1">Choose a vector store above to start chatting.</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
            <p className="text-4xl mb-3">📚</p>
            <p className="text-lg font-medium text-gray-500">
              Chatting with &ldquo;{selectedStore?.name}&rdquo;
            </p>
            <p className="text-sm mt-1">Ask a question about your uploaded documents.</p>
          </div>
        ) : (
          messages.map((msg, i) => <MessageBubble key={i} message={msg} />)
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && void handleSend()}
          placeholder={selectedStoreId ? "Ask a question…" : "Select a store first"}
          disabled={!selectedStoreId || streaming}
          className="flex-1 rounded-md border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
        />
        <button
          onClick={() => void handleSend()}
          disabled={!selectedStoreId || !input.trim() || streaming}
          className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
        >
          {streaming && <Spinner />}
          Send
        </button>
      </div>
    </div>
  );
}
