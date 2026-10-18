from src.db import get_db


class MongoStoryRepository:
    """One story bible (premise, user's role, cast) per story-mode session."""

    def __init__(self):
        self.collection = get_db()["stories"]
        self.collection.create_index("session_id", unique=True)

    def get(self, session_id):
        return self.collection.find_one({"session_id": session_id}, {"_id": 0})

    def save(self, story):
        self.collection.replace_one({"session_id": story["session_id"]}, story, upsert=True)
        return story

    def delete(self, session_id):
        self.collection.delete_many({"session_id": session_id})
