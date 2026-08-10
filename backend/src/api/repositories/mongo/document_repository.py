from bson.binary import Binary

from src.db import get_db


class MongoDocumentRepository:
    """Stores document metadata + chunk embeddings and raw uploaded bytes
    across two collections: `documents` (metadata + chunk embeddings) and
    `document_files` (raw uploaded bytes) — kept separate so listing/metadata
    reads never have to pull large binary blobs off the wire."""

    def __init__(self):
        db = get_db()
        self.collection = db["documents"]
        self.files_collection = db["document_files"]

    def list(self):
        return list(self.collection.find({}, {"_id": 0}))

    def get(self, document_id):
        return self.collection.find_one({"id": document_id}, {"_id": 0})

    def save(self, document):
        self.collection.replace_one({"id": document["id"]}, document, upsert=True)

    def delete(self, document_id):
        self.collection.delete_one({"id": document_id})
        self.files_collection.delete_one({"id": document_id})

    def save_file(self, document_id, content):
        self.files_collection.replace_one({"id": document_id}, {"id": document_id, "content": Binary(content)}, upsert=True)

    def read_file(self, document_id):
        doc = self.files_collection.find_one({"id": document_id})
        return bytes(doc["content"]) if doc else None
