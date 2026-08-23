from fastapi import APIRouter, Depends

from src.api.deps import auth_service
from src.api.endpoint.auth import router as auth_router
from src.api.endpoint.chat import router as chat_router
from src.api.endpoint.conversation import router as conversation_router
from src.api.endpoint.docs import router as docs_router
from src.api.endpoint.model import router as model_router
from src.api.endpoint.persona import router as persona_router
from src.api.endpoint.suggestion import router as suggestion_router

api_router = APIRouter(prefix="/V1")
api_router.include_router(auth_router, tags=["Auth"])
api_router.include_router(chat_router, tags=["Chat"], dependencies=[Depends(auth_service.require_auth)])
api_router.include_router(persona_router, tags=["Personas"], dependencies=[Depends(auth_service.require_auth)])
api_router.include_router(model_router, tags=["Models"], dependencies=[Depends(auth_service.require_auth)])
api_router.include_router(suggestion_router, tags=["Suggestions"], dependencies=[Depends(auth_service.require_auth)])
api_router.include_router(conversation_router, tags=["Conversations"], dependencies=[Depends(auth_service.require_auth)])
api_router.include_router(docs_router, tags=["Documents"], dependencies=[Depends(auth_service.require_auth)])

__all__ = ["api_router"]
