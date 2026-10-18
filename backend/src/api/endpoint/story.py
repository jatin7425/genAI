from fastapi import APIRouter, HTTPException

from src.api.deps import story_service
from src.api.schema.story import CharacterSaveRequest, StoryCreateRequest, StoryUpdateRequest

router = APIRouter()


@router.get("/stories/{session_id}")
def get_story(session_id: str):
    # Ordinary conversations have no story; callers use null to hide the cast panel.
    return {"story": story_service.get(session_id)}


@router.post("/stories/{session_id}")
def create_story(session_id: str, req: StoryCreateRequest):
    if not (req.description.strip() or req.premise.strip()):
        raise HTTPException(status_code=400, detail="Describe the story or write an opening narrative.")
    if story_service.get(session_id):
        raise HTTPException(status_code=409, detail="This conversation already has a story.")
    characters = [c.model_dump() for c in req.characters]
    return {"story": story_service.create(session_id, req.title, req.premise, req.user_role, characters, req.description, req.model)}


@router.patch("/stories/{session_id}")
def update_story(session_id: str, req: StoryUpdateRequest):
    story = story_service.update(session_id, **req.model_dump())
    if not story:
        raise HTTPException(status_code=404, detail="Story not found.")
    return {"story": story}


@router.put("/stories/{session_id}/characters")
def save_character(session_id: str, req: CharacterSaveRequest):
    story, error = story_service.save_character(session_id, req.name, req.description, req.original_name)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"story": story}


@router.delete("/stories/{session_id}/characters/{name}")
def remove_character(session_id: str, name: str):
    story = story_service.remove_character(session_id, name)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found.")
    return {"story": story}
