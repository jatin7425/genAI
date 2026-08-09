import json
from pathlib import Path


class JSONDocumentRepository:
    """Stores document metadata + chunk embeddings as JSON, and raw uploaded
    bytes as plain files on disk — same low-tech persistence style as
    JSONPersonaRepository, just split across an index file and a blob dir
    since embeddings/raw bytes don't belong inlined together."""

    def __init__(self, path=None, uploads_dir=None):
        data_dir = Path(__file__).resolve().parents[2] / "data"
        self.path = path or data_dir / "documents.json"
        self.uploads_dir = uploads_dir or data_dir / "uploads"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self._write([])

    def _read(self):
        with self.path.open("r", encoding="utf-8") as f:
            return json.load(f)

    def _write(self, data):
        with self.path.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def list(self):
        return self._read()

    def get(self, document_id):
        return next((d for d in self._read() if d["id"] == document_id), None)

    def save(self, document):
        data = self._read()
        data = [d for d in data if d["id"] != document["id"]]
        data.append(document)
        self._write(data)

    def delete(self, document_id):
        data = self._read()
        remaining = [d for d in data if d["id"] != document_id]
        self._write(remaining)
        file_path = self.uploads_dir / document_id
        if file_path.exists():
            file_path.unlink()

    def save_file(self, document_id, content):
        file_path = self.uploads_dir / document_id
        file_path.write_bytes(content)
        return file_path

    def read_file(self, document_id):
        file_path = self.uploads_dir / document_id
        return file_path.read_bytes() if file_path.exists() else None
