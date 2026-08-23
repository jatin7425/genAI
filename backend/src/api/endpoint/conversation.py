from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from src.api.deps import conversation_service, event_broadcaster
from src.api.schema.conversation import ConversationListResponse, ConversationUpsertRequest

router = APIRouter()


@router.get("/conversations")
def list_conversations(skip: int = 0, limit: int = 20):
    return conversation_service.list_conversations(skip=skip, limit=limit)

@router.get("/conversations/{session_id}/messages")
def get_conversation_messages(session_id: str, skip: int = 0, limit: int = 20):
    return conversation_service.get_messages(session_id, skip=skip, limit=limit)


@router.get("/conversations/stream")
def stream_conversations():
    return StreamingResponse(event_broadcaster.stream(), media_type="text/event-stream")


@router.put("/conversations/{session_id}")
def upsert_conversation(session_id: str, req: ConversationUpsertRequest):
    conversation_service.upsert_conversation(session_id, req.persona, req.turns, req.model)
    return {"status": "saved", "session_id": session_id}


@router.delete("/conversations/{session_id}")
def delete_conversation(session_id: str):
    conversation_service.delete_conversation(session_id)
    return {"status": "deleted", "session_id": session_id}
