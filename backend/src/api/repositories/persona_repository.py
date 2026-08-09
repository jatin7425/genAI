import json
from abc import ABC, abstractmethod
from pathlib import Path

DEFAULT_PERSONAS = {
    "Default Assistant": "You are a helpful, direct, and friendly assistant.",
}


class PersonaRepository(ABC):
    """Storage contract for personas. Swap the implementation (e.g. for a
    MongoPersonaRepository) without touching PersonaService or any endpoint."""

    @abstractmethod
    def list(self):
        ...

    @abstractmethod
    def get(self, name):
        ...

    @abstractmethod
    def save(self, name, prompt):
        ...

    @abstractmethod
    def delete(self, name):
        ...


class JSONPersonaRepository(PersonaRepository):
    def __init__(self, path=None):
        self.path = path or Path(__file__).resolve().parents[2] / "data" / "personas.json"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self._write(DEFAULT_PERSONAS)

    def _read(self):
        with self.path.open("r", encoding="utf-8") as f:
            return json.load(f)

    def _write(self, data):
        with self.path.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def list(self):
        return list(self._read().keys())

    def get(self, name):
        return self._read().get(name)

    def save(self, name, prompt):
        name = name.strip()
        if not name:
            raise ValueError("Persona name cannot be empty.")
        data = self._read()
        data[name] = prompt.strip()
        self._write(data)

    def delete(self, name):
        data = self._read()
        data.pop(name, None)
        self._write(data)
