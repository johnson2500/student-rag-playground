# Student RAG Playground

A student-focused quickstart that teaches Retrieval-Augmented Generation (RAG). Create named vector
stores, upload PDF and text documents, and chat against your content using a Llama-based LLM —
locally with Ollama or on Red Hat OpenShift AI.

## Quick start (local)

```bash
cp .env.example .env
make dev
```

Open [http://localhost:5173](http://localhost:5173).

> First run: Ollama will pull `llama3.2` and `nomic-embed-text` automatically (~4 GB).

## Pages

| Page | Path | Description |
|---|---|---|
| Chat | `/` (Chat tab) | Select a vector store and ask questions |
| Vector Stores | Stores tab | Create stores, upload PDFs/text, delete documents |

## Stack

| Layer | Local | OpenShift AI |
|---|---|---|
| LLM | Ollama `llama3.2` | vLLM `Llama-3.2-3B-Instruct` |
| Embedding | Ollama `nomic-embed-text` | sentence-transformers model server |
| Vector DB | PostgreSQL + pgvector | pgvector chart |
| Object storage | MinIO | MinIO chart |
| Frontend | React + Tailwind | React + Tailwind |
| Backend | FastAPI | FastAPI |

## Development

```bash
make setup        # install deps
make lint         # ruff + eslint
make test         # unit tests
make test-integration  # requires running DB + MinIO
```

## Deploy to OpenShift AI

```bash
make deploy HELM_NAMESPACE=my-namespace
```

See `deploy/helm/student-rag-playground/values.yaml` for configuration options.
