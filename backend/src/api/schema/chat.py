from pydantic import BaseModel


class ChatRequest(BaseModel):
    session_id: str | None = None
    message: str
    persona: str | None = None
    model: str | None = None
    # When true, the last user turn (and anything after it — the failed/undesired
    # attempt) is discarded from history before `message` is appended, so the
    # agent regenerates from that point instead of continuing on top of it.
    retry: bool = False
