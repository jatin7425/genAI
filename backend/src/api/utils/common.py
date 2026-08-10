import threading

from src.utils.llm_client import llmClient

class commonUtils:
    @staticmethod
    def wake_up_llm():
        def _run():
            client = llmClient()
            client.list_models()

        thread = threading.Thread(target=_run, daemon=True)
        thread.start()
        return thread