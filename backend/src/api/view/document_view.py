import uuid
from datetime import datetime, timezone

CHUNK_SIZE = 1500
CHUNK_OVERLAP = 200

TEXT_EXTENSIONS = {".txt", ".md", ".csv", ".json", ".py", ".html", ".htm", ".yaml", ".yml", ".log"}


def _looks_like_text(raw_text, threshold=0.85):
    if not raw_text:
        return False
    printable = sum(1 for ch in raw_text if ch.isprintable() or ch in "\n\r\t")
    return (printable / len(raw_text)) >= threshold


def extract_text(filename, content):
    """Best-effort text extraction. Only plain-text-ish formats are supported
    for now — binary formats like PDF/DOCX would need a parser library
    (pypdf, python-docx, ...) that isn't part of this project yet, so those
    are stored as opaque files without embeddings rather than failing the
    whole upload."""
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        if ext in TEXT_EXTENSIONS:
            text = content.decode("utf-8", errors="ignore")
        else:
            return None

    if ext not in TEXT_EXTENSIONS and not _looks_like_text(text):
        return None

    return text


def chunk_text(text, chunk_size=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    text = text.strip()
    if not text:
        return []

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start = end - overlap
    return chunks


class DocumentService:
    def __init__(self, repository, llm_client, embedding_model):
        self.repository = repository
        self.llm_client = llm_client
        self.embedding_model = embedding_model

    def _embed(self, chunks):
        if not chunks:
            return [], None
        try:
            response = self.llm_client.call_api("embeddings", {"model": self.embedding_model, "input": chunks})
            embeddings = [item.get("embedding") for item in response.get("data", [])]
            return embeddings, None
        except Exception as exc:  # noqa: BLE001 — degrade gracefully, don't fail the whole upload
            return [None] * len(chunks), str(exc)

    def upload(self, filename, content_type, content):
        if not filename:
            raise ValueError("A filename is required.")

        document_id = str(uuid.uuid4())
        text = extract_text(filename, content)
        chunks = chunk_text(text) if text else []
        embeddings, embedding_error = self._embed(chunks)

        document = {
            "id": document_id,
            "filename": filename,
            "content_type": content_type or "application/octet-stream",
            "size": len(content),
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "chunk_count": len(chunks),
            "embedded": embedding_error is None and len(chunks) > 0,
            "embedding_error": embedding_error,
            "chunks": [{"text": chunk, "embedding": embedding} for chunk, embedding in zip(chunks, embeddings)],
        }

        self.repository.save_file(document_id, content)
        self.repository.save(document)
        return self._to_summary(document)

    def list_documents(self):
        return [self._to_summary(doc) for doc in self.repository.list()]

    def delete_document(self, document_id):
        self.repository.delete(document_id)

    @staticmethod
    def _to_summary(document):
        # Embeddings are large and not useful to the client — expose metadata only.
        return {k: v for k, v in document.items() if k != "chunks"}
