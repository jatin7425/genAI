from src.db import get_db

class MongoMemoryRepository:
    def __init__(self):
        self.collection = get_db()["user_memory"]
        self.collection.create_index([("user", 1), ("key", 1)], unique=True)
    def list(self, user):
        return list(self.collection.find({"user": user}, {"_id": 0, "key": 1, "value": 1}).sort("key", 1))
    def set(self, user, key, value):
        self.collection.update_one({"user": user, "key": key}, {"$set": {"value": value}}, upsert=True)
    def delete(self, user, key):
        self.collection.delete_one({"user": user, "key": key})
    def clear(self, user):
        self.collection.delete_many({"user": user})
