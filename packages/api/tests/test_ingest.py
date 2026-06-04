"""Tests for the POST /api/ingest endpoint."""

import uuid
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from student_rag_playground.main import app

BASE = "http://test"

# Fake 768-dim embedding vector
FAKE_EMBEDDING = [0.0] * 768


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _txt_file(content: str = "hello world", filename: str = "test.txt"):
    return (filename, BytesIO(content.encode()), "text/plain")


def _pdf_file(filename: str = "test.pdf"):
    # Minimal valid PDF bytes
    minimal_pdf = (
        b"%PDF-1.0\n1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        b"3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\n"
        b"xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n"
        b"0000000058 00000 n\n0000000115 00000 n\n"
        b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF"
    )
    return (filename, BytesIO(minimal_pdf), "application/pdf")


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_upload_non_allowed_file_returns_422():
    """Uploading a .exe file should return 422."""
    store_id = str(uuid.uuid4())

    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as client:
        response = await client.post(
            "/api/ingest",
            data={"store_id": store_id},
            files={"files": ("malware.exe", BytesIO(b"MZ"), "application/octet-stream")},
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_upload_oversized_file_returns_413():
    """Uploading a file larger than MAX_UPLOAD_BYTES should return 413."""
    store_id = str(uuid.uuid4())

    # Patch max_upload_bytes to 10 so our small file appears oversized
    with patch("student_rag_playground.routers.ingest.settings") as mock_settings:
        mock_settings.max_upload_bytes = 10
        mock_settings.chunk_size = 1000
        mock_settings.chunk_overlap = 200
        mock_settings.embed_base_url = "http://fake"
        mock_settings.embed_model = "fake-model"
        mock_settings.minio_endpoint = "localhost:9000"
        mock_settings.minio_access_key = "minioadmin"
        mock_settings.minio_secret_key = "minioadmin"
        mock_settings.minio_bucket = "rag-documents"
        mock_settings.minio_secure = False

        async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as client:
            response = await client.post(
                "/api/ingest",
                data={"store_id": store_id},
                files={"files": ("big.txt", BytesIO(b"x" * 100), "text/plain")},
            )

    assert response.status_code == 413


@pytest.mark.asyncio
async def test_upload_valid_txt_returns_document_with_chunks():
    """Uploading a valid .txt file returns DocumentRead with chunk_count > 0."""
    import uuid as _uuid
    from datetime import UTC, datetime

    store_id = str(uuid.uuid4())
    doc_id = _uuid.uuid4()

    # Mock the DB session
    mock_doc = MagicMock()
    mock_doc.id = doc_id
    mock_doc.store_id = _uuid.UUID(store_id)
    mock_doc.filename = "notes.txt"
    mock_doc.chunk_count = 1
    mock_doc.created_at = datetime(2024, 1, 1, tzinfo=UTC)

    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_db.flush = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock(side_effect=lambda obj: None)

    async def override_get_db():
        yield mock_db

    from student_rag_playground.database import get_db

    # Mock MinIO client
    mock_minio = MagicMock()
    mock_minio.put_object = MagicMock()

    # Mock embedding API to return fake 768-dim vectors
    async def fake_embed(texts):
        return [FAKE_EMBEDDING for _ in texts]

    app.dependency_overrides[get_db] = override_get_db

    file_tuple = ("notes.txt", BytesIO(b"This is a test document with some content."), "text/plain")
    try:
        with (
            patch("student_rag_playground.routers.ingest._get_minio", return_value=mock_minio),
            patch("student_rag_playground.routers.ingest._embed_texts", side_effect=fake_embed),
            patch("student_rag_playground.routers.ingest.Document", return_value=mock_doc),
        ):
            async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as client:
                response = await client.post(
                    "/api/ingest",
                    data={"store_id": store_id},
                    files={"files": file_tuple},
                )
    finally:
        app.dependency_overrides = {}

    assert response.status_code == 201
    body = response.json()
    assert isinstance(body, list)
    assert len(body) == 1
    assert body[0]["filename"] == "notes.txt"
    assert body[0]["chunk_count"] > 0
