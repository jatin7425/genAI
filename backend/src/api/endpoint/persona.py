from fastapi import APIRouter, HTTPException

from src.api.deps import persona_service
from src.api.schema.persona import PersonaCreateRequest, PersonaListResponse

router = APIRouter()


@router.get("/personas", response_model=PersonaListResponse)
def list_personas():
    return {"personas": persona_service.list_personas()}


@router.post("/personas")
def create_persona(req: PersonaCreateRequest):
    persona_service.create_persona(req.name, req.prompt)
    return {"status": "created", "name": req.name}


@router.delete("/personas/{name}")
def delete_persona(name: str):
    if name == "Default Assistant":
        raise HTTPException(status_code=400, detail="Cannot delete the default persona.")
    persona_service.delete_persona(name)
    return {"status": "deleted", "name": name}
