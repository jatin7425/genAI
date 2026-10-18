from src.db import get_db
from pymongo.errors import DuplicateKeyError


class MongoConversationRepository:
    """Persists conversation history (title, persona, turns) in a
    `conversations` collection, so 'Recent Conversations' follows the user
    across browsers/devices instead of living only in one browser's
    localStorage."""

    def __init__(self):
        self.collection = get_db()["conversations"]
        self.collection.create_index("session_id")

    def list(self, skip: int = 0, limit: int = 20):
        grouped = [
            {"$sort": {"updated_at": -1, "_id": -1}},
            {"$group": {"_id": "$session_id", "conversation": {"$first": "$$ROOT"}}},
            {"$replaceRoot": {"newRoot": "$conversation"}},
        ]
        items = list(self.collection.aggregate(grouped + [
            {"$sort": {"updated_at": -1, "session_id": 1}},
            {"$skip": skip}, {"$limit": limit},
            {"$project": {"_id": 0, "turns": 0}},
        ]))
        counts = list(self.collection.aggregate(grouped + [{"$count": "total"}]))
        total = counts[0]["total"] if counts else 0
        return {"items": items, "total": total, "has_more": skip + limit < total}

    def _canonical(self, session_id):
        # Read one consistent record for legacy sessions with duplicate documents.
        return self.collection.find_one({"session_id": session_id}, sort=[("updated_at", -1), ("_id", -1)])

    def get_turns(self, session_id: int, skip: int = 0, limit: int = 20):
        doc = self._canonical(session_id)
        if not doc or "turns" not in doc:
            return {"items": [], "total": 0, "has_more": False}
        
        all_turns = doc["turns"]
        total = len(all_turns)
        
        # Reverse pagination: skip 0 means the LAST 20 items.
        # skip 20 means the 20 items BEFORE the last 20 items.
        # all_turns[-20:]
        
        if total == 0:
            return {"items": [], "total": 0, "has_more": False}
            
        start_idx = max(0, total - skip - limit)
        end_idx = total - skip
        
        if end_idx <= 0:
            items = []
        else:
            items = all_turns[start_idx:end_idx]
            
        return {
            "items": items,
            "total": total,
            "has_more": start_idx > 0
        }

    def upsert(self, conversation):
        values = dict(conversation)
        title = values.pop("title")
        existing = self._canonical(conversation["session_id"])
        # MongoDB's unique _id prevents concurrent first saves inserting twice.
        document_id = existing["_id"] if existing else conversation["session_id"]
        update = {"$set": values, "$setOnInsert": {"title": title}}
        try:
            self.collection.update_one({"_id": document_id}, update, upsert=True)
        except DuplicateKeyError:
            self.collection.update_one({"_id": document_id}, update)
        saved = self.collection.find_one({"_id": document_id}, {"_id": 0})
        return saved

    def has_generated_title(self, session_id):
        doc = self._canonical(session_id)
        return bool(doc and doc.get("title_generated"))

    def set_title(self, session_id, title):
        doc = self._canonical(session_id)
        if not doc:
            return False
        result = self.collection.update_one({"_id": doc["_id"], "title_generated": {"$ne": True}}, {"$set": {"title": title, "title_generated": True}})
        return result.matched_count > 0

    def rename(self, session_id, title):
        doc = self._canonical(session_id)
        if doc:
            self.collection.update_one({"_id": doc["_id"]}, {"$set": {"title": title, "title_generated": True}})

    def delete(self, session_id):
        self.collection.delete_many({"session_id": session_id})
