from pydantic import BaseModel, Field, field_validator


class PersonaCreateRequest(BaseModel):
    name: str
    prompt: str


class PersonaListResponse(BaseModel):
    personas: list[str]


class PersonaUpdateRequest(BaseModel):
    prompt: str = Field(min_length=1)

    @field_validator("prompt")
    @classmethod
    def validate_prompt(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Persona prompt cannot be empty.")
        return value
