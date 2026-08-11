from fastapi import APIRouter, BackgroundTasks, UploadFile

from src.api.view.dos_ingestion import IngestionService

router = APIRouter(prefix="/documents")

@router.post("/ingest")
async def upload(file: UploadFile, background: BackgroundTasks):
    raw = await file.read()
    service = IngestionService()
    doc_id = service.create_document(raw, file.filename, owner_id="operator")
    background.add_task(service.ingest, doc_id, raw, file.filename)
    return {"document_id": doc_id, "status": "processing"}