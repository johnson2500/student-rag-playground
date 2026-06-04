from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from minio import Minio
from minio.error import S3Error
from sqlalchemy import text
from student_rag_playground_db.models import Base

from student_rag_playground.config import settings
from student_rag_playground.database import engine
from student_rag_playground.routers import chat, documents, ingest, stores


async def _init_db() -> None:
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)


def _init_minio() -> None:
    client = Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )
    try:
        if not client.bucket_exists(settings.minio_bucket):
            client.make_bucket(settings.minio_bucket)
    except S3Error:
        pass  # bucket may already exist or MinIO is unavailable during tests


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    await _init_db()
    _init_minio()
    yield


app = FastAPI(title="Student RAG Playground API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stores.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(ingest.router, prefix="/api")
app.include_router(chat.router, prefix="/api")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
