from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from src.api.deps import chat_service
from src.api.schema.chat import ChatRequest

router = APIRouter()


@router.post("/chat")
def chat(req: ChatRequest):
    _, stream = chat_service.handle_message(req.session_id, req.message, req.persona, req.model, req.retry)
    return StreamingResponse(stream, media_type="text/event-stream")
