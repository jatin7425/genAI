from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, Form
from fastapi.concurrency import run_in_threadpool
from functools import partial
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel, Field
from src.api.utils.sse import sse
from src.api.deps import auth_service, companion_service, companion_gate, companion_chat

router = APIRouter(prefix="/roleplay")

class UnlockRequest(BaseModel):
    password: str = Field(min_length=1, max_length=128)
class ExtractRequest(BaseModel):
    description: str = Field(min_length=1, max_length=20000)
    model: str = Field(min_length=1, max_length=150)
class ProfileRequest(BaseModel):
    attributes: dict[str, str]
    description: str = Field(min_length=1, max_length=20000)
class MessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=20000)
    model: str = Field(min_length=1, max_length=150)
    session_id: str | None = None

def require_world(auth_token=Depends(auth_service.require_auth), x_roleplay_token: str | None = Header(default=None)):
    companion_gate.require(auth_token, x_roleplay_token)
    return x_roleplay_token

@router.post("/unlock")
def unlock(req: UnlockRequest, auth_token=Depends(auth_service.require_auth)):
    return {"token": companion_gate.unlock(auth_token, req.password)}
@router.post("/lock", dependencies=[Depends(require_world)])
def lock(token=Depends(require_world)):
    companion_gate.close(token)
    return {"status": "locked"}
@router.get("/profiles", dependencies=[Depends(require_world)])
def list_profiles(): return {"profiles": companion_service.repository.list()}
@router.post("/extract", dependencies=[Depends(require_world)])
def extract(req: ExtractRequest):
    try: return companion_service.extract(req.description, req.model)
    except HTTPException: raise
    except Exception: raise HTTPException(502, "Character extraction could not finish. Try another model or fill in the details manually.")
@router.post("/profiles", dependencies=[Depends(require_world)])
def create_profile(req: ProfileRequest): return companion_service.save(req.attributes, req.description)
@router.put("/profiles/{profile_id}", dependencies=[Depends(require_world)])
def update_profile(profile_id: str, req: ProfileRequest): return companion_service.save(req.attributes, req.description, profile_id)
@router.delete("/profiles/{profile_id}", dependencies=[Depends(require_world)])
def delete_profile(profile_id: str):
    companion_service.get(profile_id)
    companion_service.repository.delete(profile_id)
    return {"status": "deleted"}
@router.get("/profiles/{profile_id}/threads", dependencies=[Depends(require_world)])
def list_threads(profile_id: str):
    companion_service.get(profile_id)
    return {"threads": companion_service.repository.list_threads(profile_id)}
@router.post("/profiles/{profile_id}/chat", dependencies=[Depends(require_world)])
def chat(profile_id: str, req: MessageRequest):
    companion_service.get(profile_id)
    if req.session_id:
        if not companion_service.repository.thread(req.session_id, profile_id): raise HTTPException(404, "Conversation not found.")
        session_id = req.session_id
    else: session_id = companion_service.repository.new_thread(profile_id)
    running = companion_chat._sessions.get(session_id)
    if running and running.worker and running.worker.is_alive() and not running.awaiting_answer:
        raise HTTPException(409, "A response is already running in this conversation.")
    _, stream = companion_chat.handle_message(session_id, req.message, profile_id, req.model)
    def persisted_stream():
        for frame in stream:
            if frame.startswith("event: question"):
                import json, copy
                question = json.loads(frame.split("data: ", 1)[1])["question"]
                companion_service.repository.save_thread(session_id, copy.deepcopy(companion_chat._sessions[session_id].messages), question=question)
            if frame.startswith("event: done"):
                worker = companion_chat._sessions[session_id].worker
                if worker: worker.join(timeout=5)
                yield sse("done", companion_chat._sessions[session_id].result_holder.get("result", {}))
            else:
                yield frame
    return StreamingResponse(persisted_stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@router.post("/profiles/{profile_id}/images", dependencies=[Depends(require_world)])
async def upload_image(profile_id: str, file: UploadFile, role: str = Form(default="gallery")):
    try:
        raw = await file.read(10 * 1024 * 1024 + 1)
        return await run_in_threadpool(partial(companion_service.upload_image, profile_id, raw, file.filename, role))
    finally:
        await file.close()

@router.get("/profiles/{profile_id}/images/{image_id}", dependencies=[Depends(require_world)])
def image_content(profile_id: str, image_id: str):
    item = companion_service.image(profile_id, image_id)
    return Response(bytes(item["data"]), media_type=item["mime"], headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})

@router.delete("/profiles/{profile_id}/images/{image_id}", dependencies=[Depends(require_world)])
def remove_image(profile_id: str, image_id: str):
    return companion_service.delete_image(profile_id, image_id)
