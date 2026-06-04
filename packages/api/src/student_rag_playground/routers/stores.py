import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from student_rag_playground_db.models import Document, VectorStore

from student_rag_playground.database import get_db
from student_rag_playground.schemas import VectorStoreCreate, VectorStoreRead

router = APIRouter(prefix="/stores", tags=["stores"])


@router.get("", response_model=list[VectorStoreRead])
async def list_stores(db: AsyncSession = Depends(get_db)) -> list[VectorStoreRead]:  # noqa: B008
    result = await db.execute(
        select(
            VectorStore.id,
            VectorStore.name,
            VectorStore.created_at,
            func.count(Document.id).label("document_count"),
        )
        .outerjoin(Document, Document.store_id == VectorStore.id)
        .group_by(VectorStore.id)
        .order_by(VectorStore.created_at.desc())
    )
    rows = result.all()
    return [
        VectorStoreRead(
            id=row.id,
            name=row.name,
            created_at=row.created_at,
            document_count=row.document_count,
        )
        for row in rows
    ]


@router.post("", response_model=VectorStoreRead, status_code=201)
async def create_store(body: VectorStoreCreate, db: AsyncSession = Depends(get_db)) -> VectorStoreRead:  # noqa: B008
    existing = await db.execute(select(VectorStore).where(VectorStore.name == body.name))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="A store with this name already exists.")

    store = VectorStore(name=body.name)
    db.add(store)
    await db.commit()
    await db.refresh(store)
    return VectorStoreRead(
        id=store.id,
        name=store.name,
        created_at=store.created_at,
        document_count=0,
    )


@router.delete("/{store_id}", status_code=204)
async def delete_store(store_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:  # noqa: B008
    result = await db.execute(select(VectorStore).where(VectorStore.id == store_id))
    store = result.scalar_one_or_none()
    if store is None:
        raise HTTPException(status_code=404, detail="Store not found.")
    await db.delete(store)
    await db.commit()
