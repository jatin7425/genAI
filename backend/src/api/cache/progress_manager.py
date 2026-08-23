from functools import lru_cache

class ProgressManager:
    def __init__(self):
        self.connections = {}
        self.progress = {}


@lru_cache
def get_progress_manager():
    return ProgressManager()