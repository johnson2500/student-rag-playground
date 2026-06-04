export interface VectorStore {
  id: string;
  name: string;
  created_at: string;
  document_count: number;
}

export interface Document {
  id: string;
  store_id: string;
  filename: string;
  chunk_count: number;
  created_at: string;
}

export interface ChatSource {
  filename: string;
  content: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
}
