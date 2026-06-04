import uuid
from datetime import datetime

from pydantic import BaseModel


class VectorStoreCreate(BaseModel):
    name: str


class VectorStoreRead(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime
    document_count: int

    model_config = {"from_attributes": True}


class DocumentRead(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    filename: str
    chunk_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatSource(BaseModel):
    filename: str
    content: str


class ChatRequest(BaseModel):
    store_id: uuid.UUID
    question: str
    history: list[dict] = []
