from pydantic import BaseModel


class DocumentResponse(BaseModel):
    id: str
    filename: str
    content_type: str
    size: int
    uploaded_at: str
    chunk_count: int
    embedded: bool
    embedding_error: str | None = None


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
