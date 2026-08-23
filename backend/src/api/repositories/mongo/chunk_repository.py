from src.db import get_db


class MongoChunkRepository:
    def __init__(self):
        self.collection = get_db()["chunks"]

    def insert_many(self, chunks: list[dict]) -> None:
        for start in range(0, len(chunks), 1000):
            self.collection.insert_many(chunks[start:start + 1000], ordered=False)

    def delete_by_document(self, document_id: str) -> None:
        self.collection.delete_many({"document_id": document_id})

    def get_by_document(self, document_id: str, skip: int = 0, limit: int = 50) -> dict:
        pipeline = [
            {
                "$match": {
                    "document_id": document_id
                }
            },
            {
                "$sort": {
                    "chunk_index": 1
                }
            },
            {
                "$skip": skip
            },
            {
                "$limit": limit
            },
            {
                "$addFields": {
                    "embedding_length": {
                        "$cond": {
                            "if": { "$isArray": "$embedding" },
                            "then": { "$size": "$embedding" },
                            "else": 0
                        }
                    }
                }
            },
            {
                "$project": {
                    "embedding": 0
                }
            }
        ]
        chunks = list(self.collection.aggregate(pipeline))
        for chunk in chunks:
            if "_id" in chunk:
                chunk["_id"] = str(chunk["_id"])
        
        total = self.collection.count_documents({"document_id": document_id})
        return {
            "items": chunks,
            "total": total,
            "has_more": skip + limit < total
        }