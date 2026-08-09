from src.db import get_db


class MongoConversationRepository:
    """Same contract as JSONConversationRepository, backed by a
    `conversations` collection instead of a JSON file."""

    def __init__(self):
        self.collection = get_db()["conversations"]

    def list(self):
        return list(self.collection.find({}, {"_id": 0}))

    def upsert(self, conversation):
        self.collection.replace_one({"session_id": conversation["session_id"]}, conversation, upsert=True)

    def delete(self, session_id):
        self.collection.delete_one({"session_id": session_id})
