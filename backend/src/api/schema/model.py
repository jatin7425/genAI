from pydantic import BaseModel


class ModelListResponse(BaseModel):
    models: list[str]
