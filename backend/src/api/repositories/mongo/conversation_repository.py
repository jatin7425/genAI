from src.db import get_db


class MongoConversationRepository:
    """Persists conversation history (title, persona, turns) in a
    `conversations` collection, so 'Recent Conversations' follows the user
    across browsers/devices instead of living only in one browser's
    localStorage."""

    def __init__(self):
        self.collection = get_db()["conversations"]

    def list(self, skip: int = 0, limit: int = 20):
        pipeline = [
            {"$sort": {"updated_at": -1}},
            {"$skip": skip},
            {"$limit": limit},
            {"$project": {"_id": 0, "turns": 0}}
        ]
        items = list(self.collection.aggregate(pipeline))
        total = self.collection.count_documents({})
        return {
            "items": items,
            "total": total,
            "has_more": skip + limit < total
        }

    def get_turns(self, session_id: int, skip: int = 0, limit: int = 20):
        doc = self.collection.find_one({"session_id": session_id}, {"_id": 0, "turns": 1})
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
        self.collection.replace_one({"session_id": conversation["session_id"]}, conversation, upsert=True)

    def delete(self, session_id):
        self.collection.delete_one({"session_id": session_id})
