EXCLUDED_PREFIXES = ("embed-","transcribe-")


class ModelService:
    """Lists chat-capable models from the LiteLLM proxy, hiding embedding
    models (id starts with 'embed-', 'transcribe-') since those aren't valid chat targets."""

    def __init__(self, llm_client):
        self.llm_client = llm_client

    def list_models(self):
        models = self.llm_client.list_models()
        return [m["id"] for m in models if not m["id"].startswith(EXCLUDED_PREFIXES)]
