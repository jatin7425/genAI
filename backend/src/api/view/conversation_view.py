from datetime import datetime, timezone


def _title_from(turns):
    first_user_turn = next((t for t in turns if t.get("kind") == "user"), None)
    if not first_user_turn:
        return "New conversation"
    text = first_user_turn.get("text", "").strip()
    return f"{text[:60]}..." if len(text) > 60 else text


class ConversationService:
    """List/save/delete conversations, broadcasting every change through the
    shared EventBroadcaster so every connected browser sees it live."""

    def __init__(self, repository, broadcaster):
        self.repository = repository
        self.broadcaster = broadcaster

    def list_conversations(self):
        return sorted(self.repository.list(), key=lambda c: c["updated_at"], reverse=True)

    def upsert_conversation(self, session_id, persona, turns, model=None):
        if not turns:
            return
        conversation = {
            "session_id": session_id,
            "persona": persona,
            "model": model,
            "title": _title_from(turns),
            "turns": turns,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        self.repository.upsert(conversation)
        self.broadcaster.broadcast("upserted", conversation)

    def delete_conversation(self, session_id):
        self.repository.delete(session_id)
        self.broadcaster.broadcast("deleted", {"session_id": session_id})
