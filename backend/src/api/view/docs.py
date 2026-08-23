from fastapi import BackgroundTasks, UploadFile
from src.api.repositories.mongo.chunk_repository import MongoChunkRepository
from src.api.repositories.mongo.document_repository import MongoDocumentRepository
from src.api.view.dos_ingestion import IngestionService

class docService:
    def __init__(self,):
        self.doc_repo = MongoDocumentRepository()
        self.chunk_repo = MongoChunkRepository()

    async def _upload(self, file: UploadFile, background: BackgroundTasks):
        raw = await file.read()
        service = IngestionService()
        doc_id = service.create_document(raw, file.filename, owner_id="operator")
        background.add_task(service.ingest, doc_id, raw, file.filename)
        return {"document_id": doc_id, "status": "processing", "web_socket_connection": f"/ws/ingestion/{doc_id}"}


    async def _get_ingest_status(self, id: str):
        doc = self.doc_repo.get(id)
        if not doc:
            doc = self.doc_repo.find_by_hash(id, owner_id="operator")
        if not doc:
            return {"document_id": id, "status": "not found"}
        return {
            "document_id": doc.get("_id", id),
            "status": doc.get("status")
        }
    
    async def _get_document_list(self, skip: int = 0, limit: int = 20):
        return self.doc_repo.get_list(owner_id="operator", skip=skip, limit=limit)

    async def _delete_doc(self, doc_id: str):
        result = self.doc_repo.delete(doc_id, owner_id="operator")
        return {"status": "success", "deleted_count": result.deleted_count}

    async def _get_Chunks(self, doc_id: str, skip: int = 0, limit: int = 50):
        return self.chunk_repo.get_by_document(document_id=doc_id, skip=skip, limit=limit)