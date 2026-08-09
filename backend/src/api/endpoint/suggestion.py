from fastapi import APIRouter

from src.api.deps import suggestion_service
from src.api.schema.suggestion import SuggestionListResponse

router = APIRouter()


@router.get("/suggestions", response_model=SuggestionListResponse)
def get_suggestions(refresh: bool = False):
    return {"suggestions": suggestion_service.get_suggestions(force_refresh=refresh)}
