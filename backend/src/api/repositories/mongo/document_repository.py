from src.db import get_db
from src.api.repositories.mongo.chunk_repository import MongoChunkRepository

class MongoDocumentRepository:
    """Tracks uploaded documents (status, content hash, chunk count) in a
    `documents` collection, so re-uploading identical bytes is a no-op."""

    def __init__(self):
        self.collection = get_db()["documents"]
        self.chunk_repo = MongoChunkRepository()

    def insert(self, document):
        self.collection.insert_one(document)

    def find_by_hash(self, content_hash, owner_id):
        return self.collection.find_one({"content_hash": content_hash, "owner_id": owner_id})

    def update(self, doc_id, fields):
        self.collection.update_one({"_id": doc_id}, {"$set": fields})

    def get(self, doc_id):
        return self.collection.find_one({"_id": doc_id})
    
    def get_list(self, owner_id, skip: int = 0, limit: int = 20):
        items = list(
            self.collection.find({
                "owner_id": owner_id
            }).sort("indexed_at", -1).skip(skip).limit(limit)
        )
        total = self.collection.count_documents({"owner_id": owner_id})
        return {
            "items": items,
            "total": total,
            "has_more": skip + limit < total
        }

    def delete(self, doc_id, owner_id):
        self.chunk_repo.delete_by_document(document_id=doc_id)
        return self.collection.delete_one({
            "_id": doc_id,
            "owner_id": owner_id
        })