from src.db import get_db


class MongoAssetRepository:
    """Stores normalized image assets extracted from ingested documents in
    an `assets` collection, keyed by the asset ref used in chunk metadata."""

    def __init__(self):
        self.collection = get_db()["assets"]

    def save(self, ref, document_id, page, data, mime, width, height, description):
        self.collection.replace_one(
            {"_id": ref},
            {
                "_id": ref,
                "document_id": document_id,
                "page": page,
                "data": data,
                "mime": mime,
                "width": width,
                "height": height,
                "description": description,
            },
            upsert=True,
        )

    def get(self, ref):
        return self.collection.find_one({"_id": ref})
