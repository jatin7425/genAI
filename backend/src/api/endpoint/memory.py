from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from src.api.deps import memory_service
router = APIRouter()
class MemoryUpdateRequest(BaseModel):
    value: str = Field(min_length=1, max_length=2000)
@router.get("/memory")
def list_memory():
    return {"entries": memory_service.list()}
@router.put("/memory/{key}")
def save_memory(key: str, req: MemoryUpdateRequest):
    try:
        return memory_service.set(key, req.value)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
@router.delete("/memory/{key}")
def delete_memory(key: str):
    return memory_service.delete(key)
@router.delete("/memory")
def clear_memory():
    memory_service.clear()
    return {"status": "cleared"}
