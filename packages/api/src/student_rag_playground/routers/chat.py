import json

from fastapi import APIRouter, Depends, HTTPException
from openai import AsyncOpenAI
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse
from student_rag_playground_db.models import Chunk, Document, VectorStore

from student_rag_playground.config import settings
from student_rag_playground.database import get_db
from student_rag_playground.schemas import ChatRequest, ChatSource

router = APIRouter(tags=["chat"])


async def _embed_query(query: str) -> list[float]:
    client = AsyncOpenAI(base_url=settings.embed_base_url, api_key="none")
    response = await client.embeddings.create(model=settings.embed_model, input=[query])
    return response.data[0].embedding


@router.post("/chat")
async def chat(body: ChatRequest, db: AsyncSession = Depends(get_db)) -> EventSourceResponse:  # noqa: B008
    # Validate store exists
    store_result = await db.execute(select(VectorStore).where(VectorStore.id == body.store_id))
    if store_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Store not found.")

    # Embed the question
    query_embedding = await _embed_query(body.question)

    # Cosine similarity search using pgvector operator
    # <=> is cosine distance; lower = more similar
    similarity_query = (
        select(
            Chunk.id,
            Chunk.content,
            Chunk.document_id,
            Chunk.embedding.cosine_distance(query_embedding).label("distance"),
        )
        .where(Chunk.store_id == body.store_id)
        .order_by(text("distance"))
        .limit(settings.retrieval_top_k)
    )
    chunks_result = await db.execute(similarity_query)
    top_chunks = chunks_result.all()

    if not top_chunks:
        raise HTTPException(status_code=422, detail="No documents in this store yet. Please upload documents first.")

    # Fetch filenames for source attribution
    doc_ids = list({row.document_id for row in top_chunks})
    docs_result = await db.execute(select(Document).where(Document.id.in_(doc_ids)))
    docs_by_id = {doc.id: doc.filename for doc in docs_result.scalars().all()}

    sources = [
        ChatSource(filename=docs_by_id.get(row.document_id, "unknown"), content=row.content) for row in top_chunks
    ]

    context_text = "\n\n---\n\n".join(f"[Source: {s.filename}]\n{s.content}" for s in sources)

    system_prompt = (
        "You are a helpful study assistant. Answer the student's question using ONLY the provided context. "
        "If the answer is not in the context, say so. Be concise and educational.\n\n"
        f"Context:\n{context_text}"
    )

    messages = [{"role": "system", "content": system_prompt}]
    for turn in body.history:
        if "role" in turn and "content" in turn:
            messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": body.question})

    async def event_generator():
        llm_client = AsyncOpenAI(base_url=settings.llm_base_url, api_key="none")
        stream = await llm_client.chat.completions.create(
            model=settings.llm_model,
            messages=messages,  # type: ignore[arg-type]
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                yield {"data": delta}

        yield {"data": "[DONE]"}
        yield {"data": json.dumps({"sources": [s.model_dump() for s in sources]})}

    return EventSourceResponse(event_generator())
