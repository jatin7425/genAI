from functools import partial
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from src.api.deps import attachment_service
from src.api.view.attachment_view import MAX_FILE_BYTES

router = APIRouter(prefix="/attachments")


@router.post("")
async def upload_attachment(file: UploadFile):
    try:
        raw = await file.read(MAX_FILE_BYTES + 1)
        return await run_in_threadpool(partial(attachment_service.upload, raw, file.filename))
    finally:
        await file.close()


@router.get("/{attachment_id}/content")
def attachment_content(attachment_id: str):
    item = attachment_service.repository.get(attachment_id)
    if not item:
        raise HTTPException(404, "Attachment not found.")
    return Response(bytes(item["data"]), media_type=item["mime"], headers={
        "Content-Disposition": f"attachment; filename*=UTF-8''{quote(item['name'], safe='')}",
        "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    })


@router.delete("/{attachment_id}")
def delete_draft(attachment_id: str):
    if not attachment_service.repository.delete_draft(attachment_id):
        raise HTTPException(404, "Draft attachment not found.")
    return {"status": "deleted"}
