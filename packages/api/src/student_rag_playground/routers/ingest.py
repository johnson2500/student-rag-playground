import io
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from minio import Minio
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from student_rag_playground_db.models import Chunk, Document

from student_rag_playground.config import settings
from student_rag_playground.database import get_db
from student_rag_playground.schemas import DocumentRead

router = APIRouter(tags=["ingest"])

ALLOWED_EXTENSIONS = {".pdf", ".txt"}


def _get_minio() -> Minio:
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )


async def _embed_texts(texts: list[str]) -> list[list[float]]:
    client = AsyncOpenAI(base_url=settings.embed_base_url, api_key="none")
    response = await client.embeddings.create(model=settings.embed_model, input=texts)
    return [item.embedding for item in response.data]


def _extract_text_from_pdf(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    parts = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            parts.append(text)
    return "\n".join(parts)


def _split_text(text: str) -> list[str]:
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )
    return splitter.split_text(text)


@router.post("/ingest", response_model=list[DocumentRead], status_code=201)
async def ingest_files(
    store_id: uuid.UUID = Form(...),  # noqa: B008
    files: list[UploadFile] = File(...),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> list[DocumentRead]:
    results: list[DocumentRead] = []
    minio_client = _get_minio()

    for upload in files:
        filename = upload.filename or "unknown"
        ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=422, detail=f"File type not allowed: {filename}. Only .pdf and .txt.")

        # Read file and check size
        raw = await upload.read()
        if len(raw) > settings.max_upload_bytes:
            raise HTTPException(status_code=413, detail=f"File too large: {filename}.")

        doc_id = uuid.uuid4()
        minio_key = f"{store_id}/{doc_id}/{filename}"

        # Upload to MinIO
        minio_client.put_object(
            settings.minio_bucket,
            minio_key,
            io.BytesIO(raw),
            length=len(raw),
            content_type=upload.content_type or "application/octet-stream",
        )

        # Extract text
        text = _extract_text_from_pdf(raw) if ext == ".pdf" else raw.decode("utf-8", errors="replace")

        # Split text into chunks
        chunks_text = _split_text(text)
        if not chunks_text:
            chunks_text = [text[:1000]] if text.strip() else ["(empty document)"]

        # Embed chunks
        embeddings = await _embed_texts(chunks_text)

        # Persist document
        doc = Document(
            id=doc_id,
            store_id=store_id,
            filename=filename,
            minio_key=minio_key,
            chunk_count=len(chunks_text),
        )
        db.add(doc)
        await db.flush()

        # Persist chunks
        for idx, (chunk_text, embedding) in enumerate(zip(chunks_text, embeddings, strict=True)):
            chunk = Chunk(
                document_id=doc_id,
                store_id=store_id,
                content=chunk_text,
                embedding=embedding,
                chunk_index=idx,
            )
            db.add(chunk)

        await db.commit()
        await db.refresh(doc)

        results.append(
            DocumentRead(
                id=doc.id,
                store_id=doc.store_id,
                filename=doc.filename,
                chunk_count=doc.chunk_count,
                created_at=doc.created_at,
            )
        )

    return results
