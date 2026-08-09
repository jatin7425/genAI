from fastapi import APIRouter, File, HTTPException, UploadFile

from src.api.deps import document_service
from src.api.schema.upload import DocumentListResponse, DocumentResponse

router = APIRouter()


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(file: UploadFile = File(...)):
    content = await file.read()
    try:
        return document_service.upload(file.filename, file.content_type, content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/documents", response_model=DocumentListResponse)
def list_documents():
    return {"documents": document_service.list_documents()}


@router.delete("/documents/{document_id}")
def delete_document(document_id: str):
    document_service.delete_document(document_id)
    return {"status": "deleted", "id": document_id}
