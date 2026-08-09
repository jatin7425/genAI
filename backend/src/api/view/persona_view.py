class PersonaService:
    """Business logic for personas, decoupled from how they're stored."""

    def __init__(self, repository):
        self.repository = repository

    def list_personas(self):
        return self.repository.list()

    def get_prompt(self, name):
        return self.repository.get(name)

    def create_persona(self, name, prompt):
        self.repository.save(name, prompt)

    def delete_persona(self, name):
        self.repository.delete(name)
