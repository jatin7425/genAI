from pydantic import BaseModel


class Suggestion(BaseModel):
    icon: str
    title: str
    description: str


class SuggestionListResponse(BaseModel):
    suggestions: list[Suggestion]
