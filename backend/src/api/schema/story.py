from pydantic import BaseModel, Field


class StoryCharacter(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=1500)


class StoryCreateRequest(BaseModel):
    # Free-form idea (e.g. from /createstory); the model drafts any fields left blank.
    description: str = Field(default="", max_length=6000)
    title: str = Field(default="", max_length=120)
    premise: str = Field(default="", max_length=6000)
    # Empty means the user guides the narrator without being a character.
    user_role: str = Field(default="", max_length=1500)
    characters: list[StoryCharacter] = Field(default_factory=list, max_length=30)
    model: str | None = None


class StoryUpdateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=120)
    premise: str | None = Field(default=None, max_length=6000)
    user_role: str | None = Field(default=None, max_length=1500)


class CharacterSaveRequest(StoryCharacter):
    # Set when renaming an existing character.
    original_name: str | None = Field(default=None, max_length=80)
