from typing import Any

from pydantic import BaseModel


class ConversationUpsertRequest(BaseModel):
    persona: str
    model: str | None = None
    turns: list[dict[str, Any]]


class ConversationSummary(BaseModel):
    session_id: str
    persona: str
    model: str | None = None
    title: str
    turns: list[dict[str, Any]]
    updated_at: str


class ConversationListResponse(BaseModel):
    conversations: list[ConversationSummary]
