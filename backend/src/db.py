import os

from pymongo import MongoClient

_client = None


def get_db():
    """Lazily-created, process-wide Mongo connection."""
    global _client
    if _client is None:
        uri = os.getenv("MONGODB_URI")
        if not uri:
            raise RuntimeError("MONGODB_URI is not set.")
        _client = MongoClient(uri)
    return _client[os.getenv("MONGODB_DB_NAME", "cortex")]
