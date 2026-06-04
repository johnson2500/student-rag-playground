import os
import pytest
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text


@pytest.mark.asyncio
async def test_pgvector_extension():
    """Verify pgvector extension is available in the test database."""
    url = os.environ["DATABASE_URL"]
    engine = create_async_engine(url)
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT extname FROM pg_extension WHERE extname = 'vector'"))
        row = result.fetchone()
    assert row is not None, "pgvector extension not installed"
    await engine.dispose()
