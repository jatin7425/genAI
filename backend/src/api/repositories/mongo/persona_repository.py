from src.api.repositories.persona_repository import DEFAULT_PERSONAS, PersonaRepository
from src.db import get_db


class MongoPersonaRepository(PersonaRepository):
    """Same contract as JSONPersonaRepository, backed by a `personas`
    collection instead of a JSON file. Documents are {_id: name, prompt}."""

    def __init__(self):
        self.collection = get_db()["personas"]
        if self.collection.count_documents({}) == 0:
            for name, prompt in DEFAULT_PERSONAS.items():
                self.collection.insert_one({"_id": name, "prompt": prompt})

    def list(self):
        return [doc["_id"] for doc in self.collection.find({}, {"_id": 1})]

    def get(self, name):
        doc = self.collection.find_one({"_id": name})
        return doc["prompt"] if doc else None

    def save(self, name, prompt):
        name = name.strip()
        if not name:
            raise ValueError("Persona name cannot be empty.")
        self.collection.replace_one({"_id": name}, {"_id": name, "prompt": prompt.strip()}, upsert=True)

    def delete(self, name):
        self.collection.delete_one({"_id": name})
