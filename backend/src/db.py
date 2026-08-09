import os

from pymongo import MongoClient

_client = None


def get_db():
    """Lazily-created, process-wide Mongo connection. Only ever called when
    ENV=deployed (see deps.py) — local dev uses the JSON-file repositories
    and never touches this, so it's fine that MONGODB_URI is unset locally."""
    global _client
    if _client is None:
        uri = os.getenv("MONGODB_URI")
        if not uri:
            raise RuntimeError("MONGODB_URI is not set — required when ENV=deployed.")
        _client = MongoClient(uri)
    return _client[os.getenv("MONGODB_DB_NAME", "cortex")]
