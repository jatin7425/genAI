from src.db import get_db


class MongoAttachmentRepository:
    def __init__(self):
        self.collection = get_db()["chat_attachments"]
        self.collection.create_index("session_id")
        self.collection.create_index("expires_at", expireAfterSeconds=0)

    def insert(self, item):
        self.collection.insert_one(item)

    def get(self, attachment_id):
        return self.collection.find_one({"_id": attachment_id, "owner_id": "operator"})

    def bind(self, attachment_id, session_id):
        return self.collection.find_one_and_update(
            {"_id": attachment_id, "owner_id": "operator", "$or": [{"session_id": None}, {"session_id": session_id}]},
            {"$set": {"session_id": session_id}, "$unset": {"expires_at": ""}},
        ) is not None

    def list_for_session(self, session_id):
        return list(self.collection.find({"session_id": session_id, "owner_id": "operator"}, {"data": 0, "vision_data": 0, "text": 0}))

    def delete_draft(self, attachment_id):
        return self.collection.delete_one({"_id": attachment_id, "owner_id": "operator", "session_id": None}).deleted_count

    def delete_session(self, session_id):
        self.collection.delete_many({"session_id": session_id, "owner_id": "operator"})
