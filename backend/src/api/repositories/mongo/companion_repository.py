import uuid
from datetime import datetime, timezone
from src.db import get_db

class CompanionRepository:
    def __init__(self, owner):
        self.owner = owner
        db = get_db()
        self.profiles = db["companion_profiles"]
        self.threads = db["companion_threads"]
        self.images = db["companion_images"]
        self.images.create_index([("owner", 1), ("profile_id", 1)])
        self.profiles.create_index("owner")
        self.threads.create_index([("owner", 1), ("profile_id", 1)])
    def list(self):
        return [self.with_images(p) for p in self.profiles.find({"owner": self.owner}, {"_id": 0, "owner": 0}).sort("updated_at", -1)]
    def get(self, profile_id):
        profile = self.profiles.find_one({"owner": self.owner, "id": profile_id}, {"_id": 0, "owner": 0})
        return self.with_images(profile) if profile else None
    def save(self, attributes, description, profile_id=None):
        profile_id = profile_id or str(uuid.uuid4())
        profile = {"id": profile_id, "attributes": attributes, "description": description, "updated_at": datetime.now(timezone.utc).isoformat()}
        self.profiles.update_one({"_id": profile_id, "owner": self.owner}, {"$set": {**profile, "owner": self.owner}}, upsert=True)
        return self.with_images(profile)
    def with_images(self, profile):
        images = list(self.images.find({"owner": self.owner, "profile_id": profile["id"]}, {"_id": 0, "owner": 0, "profile_id": 0, "data": 0}).sort("created_at", 1))
        profile["profile_picture"] = next((image for image in images if image["role"] == "profile"), None)
        profile["photos"] = [image for image in images if image["role"] == "gallery"]
        return profile
    def image(self, profile_id, image_id):
        return self.images.find_one({"owner": self.owner, "profile_id": profile_id, "id": image_id})
    def add_image(self, item):
        self.images.insert_one({**item, "owner": self.owner})
        if item["role"] == "profile":
            self.images.delete_many({"owner": self.owner, "profile_id": item["profile_id"], "role": "profile", "id": {"$ne": item["id"]}})
    def delete_image(self, profile_id, image_id):
        return self.images.delete_one({"owner": self.owner, "profile_id": profile_id, "id": image_id}).deleted_count
    def delete(self, profile_id):
        self.profiles.delete_one({"owner": self.owner, "id": profile_id})
        self.threads.delete_many({"owner": self.owner, "profile_id": profile_id})
        self.images.delete_many({"owner": self.owner, "profile_id": profile_id})
    def new_thread(self, profile_id):
        session_id = str(uuid.uuid4())
        self.threads.insert_one({"_id": session_id, "id": session_id, "owner": self.owner, "profile_id": profile_id, "turns": [], "context_messages": [], "updated_at": datetime.now(timezone.utc).isoformat()})
        return session_id
    def thread(self, session_id, profile_id=None):
        query = {"owner": self.owner, "id": session_id}
        if profile_id is not None: query["profile_id"] = profile_id
        return self.threads.find_one(query, {"_id": 0, "owner": 0})
    def list_threads(self, profile_id):
        return list(self.threads.find({"owner": self.owner, "profile_id": profile_id}, {"_id": 0, "owner": 0, "context_messages": 0}).sort("updated_at", -1).limit(50))
    def save_thread(self, session_id, messages, question=None):
        from src.utils.context_manager import text_content
        turns = []
        calls = {}
        for index, message in enumerate(messages):
            for call in message.get("tool_calls", []):
                calls[call["id"]] = call["function"]["name"]
                if call["function"]["name"] == "ask_user":
                    import json
                    try:
                        asked = json.loads(call["function"]["arguments"]).get("question", "")
                        if asked: turns.append({"id": "question-"+str(index), "kind": "agent", "text": asked, "status": "done"})
                    except (ValueError, TypeError): pass
            role = message.get("role")
            if role in ("user", "assistant") and text_content(message).strip():
                turns.append({"id": str(index), "kind": "user" if role == "user" else "agent", "text": text_content(message), "status": "done"})
            elif role == "tool" and calls.get(message.get("tool_call_id")) == "ask_user":
                import json
                value = json.loads(message.get("content") or '""')
                turns.append({"id": str(index), "kind": "user", "text": value if isinstance(value, str) else str(value), "status": "done"})
        context_messages = messages[1:]
        if question:
            if not turns or turns[-1]["text"] != question:
                turns.append({"id": "pending-question", "kind": "agent", "text": question, "status": "done"})
            # A restored pause must not contain a function call with no result.
            context_messages = [{"role": "user" if t["kind"] == "user" else "assistant", "content": t["text"]} for t in turns]
        self.threads.update_one({"owner": self.owner, "id": session_id}, {"$set": {"turns": turns, "context_messages": context_messages, "updated_at": datetime.now(timezone.utc).isoformat()}})
