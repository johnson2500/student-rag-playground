"""Tests for the /api/stores endpoints."""

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from student_rag_playground.database import get_db
from student_rag_playground.main import app

BASE = "http://test"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _async_override(mock_db):
    """Return a FastAPI dependency-override function that yields mock_db."""

    async def _override():
        yield mock_db

    return _override


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_stores_returns_array():
    """GET /api/stores returns a JSON array."""
    mock_result = MagicMock()
    mock_result.all.return_value = []

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)

    app.dependency_overrides[get_db] = _async_override(mock_db)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as client:
            response = await client.get("/api/stores")
    finally:
        app.dependency_overrides = {}

    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_create_store_returns_201():
    """POST /api/stores creates a new store and returns 201."""
    store_id = uuid.uuid4()
    created = datetime(2024, 1, 1, tzinfo=UTC)

    # Simulate "no existing store with that name"
    existing_result = MagicMock()
    existing_result.scalar_one_or_none.return_value = None

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=existing_result)
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()

    # db.refresh should set attributes on the passed store object
    async def _refresh(obj):
        obj.id = store_id
        obj.created_at = created

    mock_db.refresh = AsyncMock(side_effect=_refresh)

    app.dependency_overrides[get_db] = _async_override(mock_db)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as client:
            response = await client.post("/api/stores", json={"name": "my-store"})
    finally:
        app.dependency_overrides = {}

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "my-store"
    assert body["document_count"] == 0
    assert "id" in body


@pytest.mark.asyncio
async def test_delete_store_returns_204():
    """DELETE /api/stores/{id} returns 204 when store exists."""
    store_id = uuid.uuid4()

    mock_store = MagicMock()
    mock_store.id = store_id

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = mock_store

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=result_mock)
    mock_db.delete = AsyncMock()
    mock_db.commit = AsyncMock()

    app.dependency_overrides[get_db] = _async_override(mock_db)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as client:
            response = await client.delete(f"/api/stores/{store_id}")
    finally:
        app.dependency_overrides = {}

    assert response.status_code == 204


@pytest.mark.asyncio
async def test_create_duplicate_store_returns_409():
    """POST /api/stores returns 409 when a store with the same name exists."""
    mock_existing = MagicMock()

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = mock_existing

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=result_mock)

    app.dependency_overrides[get_db] = _async_override(mock_db)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as client:
            response = await client.post("/api/stores", json={"name": "duplicate-store"})
    finally:
        app.dependency_overrides = {}

    assert response.status_code == 409
