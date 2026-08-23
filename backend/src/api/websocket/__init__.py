from fastapi import APIRouter
from src.api.websocket.ingestion import router as ingestion_router, send_ingestion_progress

router = APIRouter()

router.include_router(ingestion_router, tags=["Auth"])

__All__ = ["send_ingestion_progress"]