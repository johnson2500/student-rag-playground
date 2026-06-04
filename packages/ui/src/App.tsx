import { useState } from "react";
import ChatPage from "./pages/ChatPage";
import StoresPage from "./pages/StoresPage";

type Page = "chat" | "stores";

export default function App() {
  const [page, setPage] = useState<Page>("chat");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
        <span className="font-bold text-lg text-indigo-600">RAG Playground</span>
        <button
          onClick={() => setPage("chat")}
          className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
            page === "chat"
              ? "bg-indigo-100 text-indigo-700"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => setPage("stores")}
          className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
            page === "stores"
              ? "bg-indigo-100 text-indigo-700"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Vector Stores
        </button>
      </nav>
      <main className="flex-1 p-6">
        {page === "chat" ? <ChatPage /> : <StoresPage />}
      </main>
    </div>
  );
}
