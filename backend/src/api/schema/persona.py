from pydantic import BaseModel


class PersonaCreateRequest(BaseModel):
    name: str
    prompt: str


class PersonaListResponse(BaseModel):
    personas: list[str]
