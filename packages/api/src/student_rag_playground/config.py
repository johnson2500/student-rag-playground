from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    llm_base_url: str = "http://localhost:11434/v1"
    llm_model: str = "llama3.2"

    embed_base_url: str = "http://localhost:11434/v1"
    embed_model: str = "nomic-embed-text"

    database_url: str = "postgresql+asyncpg://rag:rag@localhost:5432/ragdb"

    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "rag-documents"
    minio_secure: bool = False

    max_upload_bytes: int = 20 * 1024 * 1024  # 20 MB
    retrieval_top_k: int = 5
    chunk_size: int = 1000
    chunk_overlap: int = 200


settings = Settings()
