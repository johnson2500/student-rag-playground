import { useEffect, useRef, useState } from "react";
import * as api from "../api/client";
import Spinner from "../components/Spinner";
import type { Document, VectorStore } from "../types";

export default function StoresPage() {
  const [stores, setStores] = useState<VectorStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New store form
  const [showNewStore, setShowNewStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [creating, setCreating] = useState(false);

  // Expanded store
  const [expandedStoreId, setExpandedStoreId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Record<string, Document[]>>({});
  const [docsLoading, setDocsLoading] = useState<Record<string, boolean>>({});

  // Upload state
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadStoreId, setActiveUploadStoreId] = useState<string | null>(null);

  async function loadStores() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getStores();
      setStores(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStores();
  }, []);

  async function handleCreateStore() {
    if (!newStoreName.trim()) return;
    setCreating(true);
    try {
      const store = await api.createStore(newStoreName.trim());
      setStores((prev) => [store, ...prev]);
      setNewStoreName("");
      setShowNewStore(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteStore(id: string) {
    if (!window.confirm("Delete this store and all its documents?")) return;
    try {
      await api.deleteStore(id);
      setStores((prev) => prev.filter((s) => s.id !== id));
      if (expandedStoreId === id) setExpandedStoreId(null);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleExpandStore(id: string) {
    if (expandedStoreId === id) {
      setExpandedStoreId(null);
      return;
    }
    setExpandedStoreId(id);
    if (!documents[id]) {
      setDocsLoading((prev) => ({ ...prev, [id]: true }));
      try {
        const docs = await api.getDocuments(id);
        setDocuments((prev) => ({ ...prev, [id]: docs }));
      } catch (err) {
        setError(String(err));
      } finally {
        setDocsLoading((prev) => ({ ...prev, [id]: false }));
      }
    }
  }

  async function handleDeleteDocument(storeId: string, docId: string) {
    if (!window.confirm("Delete this document?")) return;
    try {
      await api.deleteDocument(storeId, docId);
      setDocuments((prev) => ({
        ...prev,
        [storeId]: (prev[storeId] ?? []).filter((d) => d.id !== docId),
      }));
      setStores((prev) =>
        prev.map((s) => (s.id === storeId ? { ...s, document_count: s.document_count - 1 } : s)),
      );
    } catch (err) {
      setError(String(err));
    }
  }

  function handleUploadClick(storeId: string) {
    setActiveUploadStoreId(storeId);
    fileInputRef.current?.click();
  }

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeUploadStoreId) return;

    const storeId = activeUploadStoreId;
    setUploading((prev) => ({ ...prev, [storeId]: true }));
    try {
      const newDocs = await api.ingestFiles(storeId, Array.from(files));
      setDocuments((prev) => ({
        ...prev,
        [storeId]: [...newDocs, ...(prev[storeId] ?? [])],
      }));
      setStores((prev) =>
        prev.map((s) => (s.id === storeId ? { ...s, document_count: s.document_count + newDocs.length } : s)),
      );
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading((prev) => ({ ...prev, [storeId]: false }));
      // Reset input so same files can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
      setActiveUploadStoreId(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Vector Stores</h1>
        <button
          onClick={() => setShowNewStore((v) => !v)}
          className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          {showNewStore ? "Cancel" : "New Store"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {showNewStore && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 flex gap-3 items-center">
          <input
            type="text"
            value={newStoreName}
            onChange={(e) => setNewStoreName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleCreateStore()}
            placeholder="Store name (e.g. CS101 Lecture Notes)"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={() => void handleCreateStore()}
            disabled={creating || !newStoreName.trim()}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {creating && <Spinner />}
            Create
          </button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt"
        multiple
        className="hidden"
        onChange={(e) => void handleFilesSelected(e)}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : stores.length === 0 ? (
        <p className="text-center text-gray-500 py-12">No stores yet. Create one to get started.</p>
      ) : (
        <div className="space-y-3">
          {stores.map((store) => (
            <div key={store.id} className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                onClick={() => void handleExpandStore(store.id)}
              >
                <div>
                  <p className="font-medium text-gray-900">{store.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{store.document_count} document{store.document_count !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUploadClick(store.id);
                    }}
                    disabled={uploading[store.id]}
                    className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 flex items-center gap-1"
                  >
                    {uploading[store.id] ? <Spinner /> : null}
                    Upload
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteStore(store.id);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100"
                  >
                    Delete
                  </button>
                  <span className="text-gray-400 text-sm">{expandedStoreId === store.id ? "▲" : "▼"}</span>
                </div>
              </div>

              {expandedStoreId === store.id && (
                <div className="border-t border-gray-100 px-4 py-3">
                  {docsLoading[store.id] ? (
                    <div className="flex justify-center py-4">
                      <Spinner />
                    </div>
                  ) : (documents[store.id] ?? []).length === 0 ? (
                    <p className="text-sm text-gray-400 py-2">No documents. Upload some files above.</p>
                  ) : (
                    <ul className="space-y-2">
                      {(documents[store.id] ?? []).map((doc) => (
                        <li key={doc.id} className="flex items-center justify-between text-sm">
                          <div>
                            <span className="font-medium text-gray-800">{doc.filename}</span>
                            <span className="ml-2 text-xs text-gray-400">{doc.chunk_count} chunks</span>
                          </div>
                          <button
                            onClick={() => void handleDeleteDocument(store.id, doc.id)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
