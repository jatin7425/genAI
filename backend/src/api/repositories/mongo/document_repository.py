from src.db import get_db


class MongoDocumentRepository:
    """Tracks uploaded documents (status, content hash, chunk count) in a
    `documents` collection, so re-uploading identical bytes is a no-op."""

    def __init__(self):
        self.collection = get_db()["documents"]

    def insert(self, document):
        self.collection.insert_one(document)

    def find_by_hash(self, content_hash, owner_id):
        return self.collection.find_one({"content_hash": content_hash, "owner_id": owner_id})

    def update(self, doc_id, fields):
        self.collection.update_one({"_id": doc_id}, {"$set": fields})

    def get(self, doc_id):
        return self.collection.find_one({"_id": doc_id})