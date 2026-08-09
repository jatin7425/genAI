import json
from pathlib import Path


class JSONConversationRepository:
    """Persists conversation history server-side (title, persona, turns) so
    'Recent Conversations' follows the user across browsers/devices instead
    of living only in one browser's localStorage. Single flat JSON file,
    same low-tech pattern as JSONPersonaRepository — fine for the single
    hardcoded operator account this app currently supports."""

    def __init__(self, path=None):
        self.path = path or Path(__file__).resolve().parents[2] / "data" / "conversations.json"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self._write([])

    def _read(self):
        with self.path.open("r", encoding="utf-8") as f:
            return json.load(f)

    def _write(self, data):
        with self.path.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def list(self):
        return self._read()

    def upsert(self, conversation):
        data = self._read()
        data = [c for c in data if c["session_id"] != conversation["session_id"]]
        data.append(conversation)
        self._write(data)

    def delete(self, session_id):
        data = self._read()
        remaining = [c for c in data if c["session_id"] != session_id]
        self._write(remaining)
