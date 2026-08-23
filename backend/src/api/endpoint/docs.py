from fastapi import APIRouter, BackgroundTasks, UploadFile

from src.api.view.docs import docService
from src.api.repositories.mongo.document_repository import MongoDocumentRepository
from src.api.view.dos_ingestion import IngestionService

router = APIRouter(prefix="/documents")

doc_service = docService()

@router.post("/ingest")
async def upload(file: UploadFile, background: BackgroundTasks):
    return await doc_service._upload(file, background)

@router.post("/ingest/status/{id}")
async def get_ingest_status(id: str):
    return await doc_service._get_ingest_status(id)

@router.get("/list")
async def get_document_list(skip: int = 0, limit: int = 20):
    return await doc_service._get_document_list(skip, limit)

@router.delete("/delete")
async def delete_doc(doc_id: str):
    return await doc_service._delete_doc(doc_id)

@router.get("/chunks/list/{doc_id}")
async def get_Chunks(doc_id: str, skip: int = 0, limit: int = 50):
    return await doc_service._get_Chunks(doc_id, skip, limit)