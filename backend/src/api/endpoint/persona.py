from fastapi import APIRouter, HTTPException

from src.api.deps import persona_service
from src.api.schema.persona import PersonaCreateRequest, PersonaListResponse, PersonaUpdateRequest

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


@router.get("/personas/{name}")
def get_persona(name: str):
    prompt = persona_service.get_prompt(name)
    if prompt is None:
        raise HTTPException(status_code=404, detail="Persona not found.")
    return {"name": name, "prompt": prompt}


@router.put("/personas/{name}")
def update_persona(name: str, req: PersonaUpdateRequest):
    if not persona_service.update_persona(name, req.prompt):
        raise HTTPException(status_code=404, detail="Persona not found.")
    return {"status": "updated", "name": name}
