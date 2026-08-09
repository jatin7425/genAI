from fastapi import APIRouter

from src.api.deps import model_service
from src.api.schema.model import ModelListResponse

router = APIRouter()


@router.get("/models", response_model=ModelListResponse)
def list_models():
    return {"models": model_service.list_models()}
