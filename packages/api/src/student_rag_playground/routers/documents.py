import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from student_rag_playground_db.models import Document, VectorStore

from student_rag_playground.database import get_db
from student_rag_playground.schemas import DocumentRead

router = APIRouter(prefix="/stores", tags=["documents"])


@router.get("/{store_id}/documents", response_model=list[DocumentRead])
async def list_documents(store_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> list[DocumentRead]:  # noqa: B008
    result = await db.execute(select(VectorStore).where(VectorStore.id == store_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Store not found.")

    docs_result = await db.execute(
        select(Document).where(Document.store_id == store_id).order_by(Document.created_at.desc())
    )
    docs = docs_result.scalars().all()
    return [
        DocumentRead(
            id=doc.id,
            store_id=doc.store_id,
            filename=doc.filename,
            chunk_count=doc.chunk_count,
            created_at=doc.created_at,
        )
        for doc in docs
    ]


@router.delete("/{store_id}/documents/{doc_id}", status_code=204)
async def delete_document(store_id: uuid.UUID, doc_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:  # noqa: B008
    result = await db.execute(select(Document).where(Document.id == doc_id, Document.store_id == store_id))
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    await db.delete(doc)
    await db.commit()
