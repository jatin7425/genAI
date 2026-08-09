from fastapi import APIRouter, Depends

from src.api.deps import auth_service
from src.api.schema.auth import LoginRequest, LoginResponse

router = APIRouter()


@router.post("/auth/login", response_model=LoginResponse)
def login(req: LoginRequest):
    token = auth_service.login(req.username, req.password)
    return LoginResponse(token=token)


@router.post("/auth/logout")
def logout(token: str = Depends(auth_service.require_auth)):
    auth_service.logout(token)
    return {"status": "logged_out"}
