from __future__ import annotations

from io import BytesIO
from pathlib import Path
import sys
from typing import Any
import fitz
import io
from docx import Document
from PIL import Image
from bson import Binary
from datetime import datetime, timezone
import hashlib
import logging

from bson import ObjectId


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.utils.llm_client import llmClient
from src.api.repositories.mongo.asset_repository import MongoAssetRepository
from src.api.repositories.mongo.chunk_repository import MongoChunkRepository
from src.api.repositories.mongo.document_repository import MongoDocumentRepository
from src.utils.text_chunker import TextChunker
from src.config import CONFIG

_VALIDATION = CONFIG.get("validation", {})
MAX_FILE_MB = _VALIDATION["MAX_FILE_MB"]
MAX_PAGES = _VALIDATION["MAX_PAGES"]
MAX_IMAGES = _VALIDATION["MAX_IMAGES"]

logger = logging.getLogger(__name__)

class IngestionService:
    def __init__(self):
        self.documents = MongoDocumentRepository()
        self.chunks = MongoChunkRepository()

    def create_document(self, raw: bytes, filename: str, owner_id: str) -> str:
        """Called by the API on upload. Returns immediately."""
        content_hash = hashlib.sha256(raw).hexdigest()

        existing = self.documents.find_by_hash(content_hash, owner_id)
        if existing:
            return existing["_id"]          # already ingested, no-op

        doc_id = str(ObjectId())
        self.documents.insert({
            "_id": doc_id,
            "owner_id": owner_id,
            "filename": filename,
            "content_hash": content_hash,
            "status": "processing",
            "chunk_count": 0,
            "pipeline_version": 1,
            "created_at": datetime.now(timezone.utc),
        })
        return doc_id

    def ingest(self, doc_id: str, raw: bytes, filename: str) -> None:
        """The entrypoint. Everything after upload happens here."""
        logger.info("Ingestion started for document %s (%s)", doc_id, filename)
        try:
            # idempotent: wipe any partial run
            self.chunks.delete_by_document(doc_id)

            ingestion = doc_ingestion(doc=raw, filename=filename)
            chunks = ingestion.process_embedding(doc_id, doc_title=filename)
            logger.info("Document %s produced %d chunks", doc_id, len(chunks))

            if chunks:
                self.chunks.insert_many(chunks)

            self.documents.update(doc_id, {
                "status": "indexed",
                "chunk_count": len(chunks),
                "indexed_at": datetime.now(timezone.utc),
            })
            logger.info("Ingestion finished for document %s", doc_id)

            return True
        except Exception as e:
            logger.exception("Ingestion failed for document %s", doc_id)
            self.documents.update(doc_id, {
                "status": "failed",
                "error": str(e),
            })
            return False

class doc_ingestion:
    def __init__(
        self,
        doc: bytes,
        filename: str,
    ):
        self.llm_client = llmClient()
        self.assets = MongoAssetRepository()
        self.doc = doc
        self.filename = filename
        self.chunker = TextChunker()

    def upload_doc(self) -> list[dict[str, Any]]:
        self._validate_size()

        file_type = self._detect_file_type()
        logger.debug("Detected file type %s for %s", file_type, self.filename)

        if file_type == "pdf":
            return self._process_pdf()

        if file_type == "docx":
            return self._process_docx()

        raise ValueError(
            f"Unsupported document type: {file_type}"
        )

    def process_embedding(self, doc_id: str, doc_title: str) -> list[dict]:
        elements = self.upload_doc()
        logger.info("Extracted %d elements from %s", len(elements), self.filename)

        # 1. elements -> chunks (text splits, images stay whole)
        chunks = []
        for el in elements:
            logger.info("total chunks proceessed %d ouf of %d", len(chunks), len(elements))
            if el["type"] == "text":
                for piece in self.chunker.chunk(el["content"]):
                    chunks.append({
                        "document_id": doc_id,
                        "chunk_index": len(chunks),
                        "modality": "text",
                        "text": piece,
                        "page": el["page"],
                    })
            else:
                ref = f"{doc_id}_p{el['page']}_{len(chunks)}"
                self._store_asset(
                    ref=ref,
                    doc_id=doc_id,
                    raw=el["content"],
                    page=el["page"],
                    summary=el["summary"],
                )
                chunks.append({
                    "document_id": doc_id,
                    "chunk_index": len(chunks),
                    "modality": "image",
                    "text": el["summary"],
                    "page": el["page"],
                    "asset_ref": ref,
                })

        logger.info("Built %d chunks for %s", len(chunks), self.filename)

        # 2. build embed strings from neighbours
        embed_inputs = [
            self._build_embed_text(
                chunks[i],
                chunks[i - 1] if i > 0 else None,
                chunks[i + 1] if i < len(chunks) - 1 else None,
                doc_title,
            )
            for i in range(len(chunks))
        ]

        # 3. batch embed at 100
        for start in range(0, len(embed_inputs), 100):
            logger.debug(
                "Embedding batch %d-%d of %d for %s",
                start, min(start + 100, len(embed_inputs)), len(embed_inputs), self.filename,
            )
            vectors = self.llm_client.embed(embed_inputs[start:start + 100])
            for j, v in enumerate(vectors):
                chunks[start + j]["embedding"] = v

        logger.info("Embedded %d chunks for %s", len(chunks), self.filename)
        return chunks

    def _validate_size(self):
        max_bytes = MAX_FILE_MB * 1024 * 1024

        if len(self.doc) > max_bytes:
            logger.warning(
                "Rejected %s: %d bytes exceeds %d MB limit",
                self.filename, len(self.doc), MAX_FILE_MB,
            )
            raise ValueError(
                f"File exceeds maximum size of "
                f"{MAX_FILE_MB} MB."
            )

    def _detect_file_type(self) -> str:

        # PDF magic bytes
        if self.doc[:4] == b"%PDF":
            return "pdf"

        filename = self.filename.lower()

        if filename.endswith(".docx"):
            return "docx"

        if filename.endswith(".pptx"):
            return "pptx"

        if filename.endswith(".xlsx"):
            return "xlsx"

        if filename.endswith(".doc"):
            return "doc"

        return "unknown"

    def _process_pdf(self) -> list[dict[str, Any]]:

        pdf = fitz.open(
            stream=self.doc,
            filetype="pdf",
        )

        try:
            if len(pdf) > MAX_PAGES:
                logger.warning(
                    "Rejected %s: %d pages exceeds %d page limit",
                    self.filename, len(pdf), MAX_PAGES,
                )
                raise ValueError(
                    f"Document contains {len(pdf)} pages. "
                    f"Maximum allowed is {MAX_PAGES}."
                )

            logger.debug("Processing %d pages for %s", len(pdf), self.filename)
            blocks = []
            self.image_count = 0
            global_order = 0

            for page_number, page in enumerate(
                pdf,
                start=1,
            ):

                page_blocks = []
                page_data = page.get_text("dict")

                for block in page_data.get("blocks", []):

                    bbox = block.get("bbox")

                    if not bbox:
                        continue

                    component = self.process_component(
                        block=block,
                        page_number=page_number,
                        bbox=bbox,
                    )

                    if component:
                        page_blocks.append(component)


                page_blocks.sort(
                    key=lambda x: (
                        x["bbox"][1],
                        x["bbox"][0],
                    )
                )

                for block in page_blocks:
                    global_order += 1
                    block["order"] = global_order
                    blocks.append(block)

            logger.info("Extracted %d blocks from %s", len(blocks), self.filename)
            return blocks

        finally:
            pdf.close()

    def _process_docx(self) -> list[dict[str, Any]]:
        """docx has no native pagination without rendering, so every
        element is reported on page 1 with an empty bbox."""
        document = Document(BytesIO(self.doc))

        blocks = []
        self.image_count = 0
        order = 0

        for paragraph in document.paragraphs:
            text = paragraph.text.strip()
            if not text:
                continue

            order += 1
            blocks.append({
                "type": "text",
                "page": 1,
                "bbox": [0, 0, 0, 0],
                "content": text,
                "order": order,
            })

        for rel in document.part.rels.values():
            if "image" not in rel.reltype:
                continue

            self.image_count += 1
            if self.image_count > MAX_IMAGES:
                logger.warning(
                    "Rejected %s: more than %d images", self.filename, MAX_IMAGES,
                )
                raise ValueError(
                    f"Document contains more than "
                    f"{MAX_IMAGES} images."
                )

            image_bytes = rel.target_part.blob
            mime_type = rel.target_part.content_type
            logger.debug("Summarizing image %d (%s) in %s", self.image_count, mime_type, self.filename)

            image_summary = self.llm_client.image_summarizer(
                image=image_bytes,
                mime_type=mime_type,
            )

            order += 1
            blocks.append({
                "type": "image",
                "page": 1,
                "bbox": [0, 0, 0, 0],
                "content": image_bytes,
                "mime_type": mime_type,
                "summary": image_summary,
                "order": order,
            })

        logger.info("Extracted %d blocks from %s", len(blocks), self.filename)
        return blocks

    def _extract_text(self, block: dict) -> str:

        lines = []

        for line in block.get("lines", []):

            text = "".join(
                span.get("text", "")
                for span in line.get("spans", [])
            )

            if text:
                lines.append(text)

        return "\n".join(lines)

    def process_component(
        self,
        block: dict,
        page_number: int,
        bbox,
    ):
        handlers = {
            0: self._process_text_component,
            1: self._process_image_component,
        }

        handler = handlers.get(block.get("type"))

        if handler is None:
            return None

        return handler(
            block=block,
            page_number=page_number,
            bbox=bbox,
        )

    def _process_text_component(
        self,
        block: dict,
        page_number: int,
        bbox,
    ):
        text = self._extract_text(block)

        if not text.strip():
            return None

        return {
            "type": "text",
            "page": page_number,
            "bbox": list(bbox),
            "content": text,
        }

    def _process_image_component(
        self,
        block: dict,
        page_number: int,
        bbox,
    ):
        self.image_count += 1

        if self.image_count > MAX_IMAGES:
            logger.warning(
                "Rejected %s: more than %d images", self.filename, MAX_IMAGES,
            )
            raise ValueError(
                f"Document contains more than "
                f"{MAX_IMAGES} images."
            )

        image_bytes = block.get("image")
        image_ext = block.get("ext", "png")
        mime_type = f"image/{image_ext}"

        if not image_bytes:
            return None

        logger.debug(
            "Summarizing image %d (%s) on page %d of %s",
            self.image_count, mime_type, page_number, self.filename,
        )
        image_summary = self.llm_client.image_summarizer(
            image=image_bytes,
            mime_type=mime_type,
        )

        return {
            "type": "image",
            "page": page_number,
            "bbox": list(bbox),
            "content": image_bytes,
            "mime_type": mime_type,
            "summary": image_summary,
        }

    def _build_embed_text(self, chunk, prev, nxt, doc_title) -> str:
        parts = [doc_title]
        if prev:
            parts.append(f"Before: {prev['text'][:150]}")
        if chunk["modality"] == "image":
            parts.append(f"Figure (page {chunk['page']}): {chunk['text']}")
        else:
            parts.append(chunk["text"])
        if nxt:
            parts.append(f"After: {nxt['text'][:150]}")
        return "\n".join(parts)

    def _normalize_image(self, raw: bytes, max_dim: int = 1600) -> tuple[bytes, str, int, int]:
        """Downscale and convert to WebP. Returns (bytes, mime, width, height)."""
        img = Image.open(io.BytesIO(raw))
        img.thumbnail((max_dim, max_dim))

        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGB")

        buf = io.BytesIO()
        img.save(buf, format="WEBP", quality=80)
        return buf.getvalue(), "image/webp", img.width, img.height

    def _store_asset(self, ref: str, doc_id: str, raw: bytes, page: int, summary: str) -> None:
        data, mime, w, h = self._normalize_image(raw)

        self.assets.save(
            ref=ref,
            document_id=doc_id,
            page=page,
            data=Binary(data),
            mime=mime,
            width=w,
            height=h,
            description=summary,
        )
        logger.debug("Stored asset %s (%s, %dx%d) for document %s", ref, mime, w, h, doc_id)