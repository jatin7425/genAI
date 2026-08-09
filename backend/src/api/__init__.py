from fastapi import APIRouter, Depends

from src.api.deps import auth_service
from src.api.endpoint.auth import router as auth_router
from src.api.endpoint.chat import router as chat_router
from src.api.endpoint.conversation import router as conversation_router
from src.api.endpoint.model import router as model_router
from src.api.endpoint.persona import router as persona_router
from src.api.endpoint.suggestion import router as suggestion_router
from src.api.endpoint.upload import router as upload_router

api_router = APIRouter(prefix="/V1")
api_router.include_router(auth_router, tags=["auth"])
api_router.include_router(chat_router, tags=["chat"], dependencies=[Depends(auth_service.require_auth)])
api_router.include_router(persona_router, tags=["personas"], dependencies=[Depends(auth_service.require_auth)])
api_router.include_router(upload_router, tags=["documents"], dependencies=[Depends(auth_service.require_auth)])
api_router.include_router(model_router, tags=["models"], dependencies=[Depends(auth_service.require_auth)])
api_router.include_router(suggestion_router, tags=["suggestions"], dependencies=[Depends(auth_service.require_auth)])
api_router.include_router(
    conversation_router, tags=["conversations"], dependencies=[Depends(auth_service.require_auth)]
)

__all__ = ["api_router"]
