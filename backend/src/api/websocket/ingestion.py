from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from src.api.cache import get_progress_manager

router = APIRouter()


@router.websocket("/ws/ingestion/{document_id}")
async def ingestion_websocket(
    websocket: WebSocket,
    document_id: str
):
    await websocket.accept()

    manager = get_progress_manager()

    # Store this WebSocket connection
    manager.connections[document_id] = websocket

    # Send connection confirmation
    await websocket.send_json({
        "status": "connected",
        "document_id": document_id
    })

    # If ingestion already started, send current progress
    current_progress = manager.progress.get(document_id)

    if current_progress:
        await websocket.send_json(current_progress)

    try:
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        # Remove connection when frontend disconnects
        manager.connections.pop(document_id, None)

async def send_ingestion_progress(doc_id: str | None, progress_data: dict) -> bool:
    if not doc_id:
        return False
    manager = get_progress_manager()
    
    manager.progress[doc_id] = progress_data

    # Send to frontend if connected
    websocket = manager.connections.get(doc_id)

    if websocket:
        await websocket.send_json(progress_data)
    return True