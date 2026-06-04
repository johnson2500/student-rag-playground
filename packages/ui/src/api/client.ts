import type { ChatMessage, ChatSource, Document, VectorStore } from "../types";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function getStores(): Promise<VectorStore[]> {
  return request<VectorStore[]>("/stores");
}

export async function createStore(name: string): Promise<VectorStore> {
  return request<VectorStore>("/stores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function deleteStore(id: string): Promise<void> {
  const res = await fetch(`${BASE}/stores/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
}

export async function getDocuments(storeId: string): Promise<Document[]> {
  return request<Document[]>(`/stores/${storeId}/documents`);
}

export async function deleteDocument(storeId: string, docId: string): Promise<void> {
  const res = await fetch(`${BASE}/stores/${storeId}/documents/${docId}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
}

export async function ingestFiles(storeId: string, files: File[]): Promise<Document[]> {
  const form = new FormData();
  form.append("store_id", storeId);
  for (const file of files) {
    form.append("files", file);
  }
  return request<Document[]>("/ingest", {
    method: "POST",
    body: form,
  });
}

export function chatStream(
  storeId: string,
  question: string,
  history: ChatMessage[],
): ReadableStream<string> {
  const historyPayload = history.map((m) => ({ role: m.role, content: m.content }));

  let controller!: ReadableStreamDefaultController<string>;

  const stream = new ReadableStream<string>({
    start(c) {
      controller = c;
    },
  });

  // Fire-and-forget async function that feeds the stream
  (async () => {
    try {
      const res = await fetch(`${BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_id: storeId, question, history: historyPayload }),
      });

      if (!res.ok || !res.body) {
        const body = await res.text();
        controller.error(new Error(`HTTP ${res.status}: ${body}`));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            controller.enqueue(line.slice(6));
          }
        }
      }
      controller.close();
    } catch (err) {
      controller.error(err);
    }
  })();

  return stream;
}

export type { ChatSource };
