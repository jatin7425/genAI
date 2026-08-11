from src.db import get_db


class MongoChunkRepository:
    def __init__(self):
        self.collection = get_db()["chunks"]

    def insert_many(self, chunks: list[dict]) -> None:
        for start in range(0, len(chunks), 1000):
            self.collection.insert_many(chunks[start:start + 1000], ordered=False)

    def delete_by_document(self, document_id: str) -> None:
        self.collection.delete_many({"document_id": document_id})