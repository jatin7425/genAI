import queue

from src.utils.interaction_bridge import InteractionBridge


class Session:
    """Runtime state for one active conversation: message history plus the live
    worker thread / bridge used to pause on ask_user. This is process-local
    runtime state — not persisted data, so it has no repository. If chat
    history itself needs persisting later, that's a separate ConversationRepository
    built the same way as PersonaRepository, storing just `messages`."""

    def __init__(self, system_message, model=None):
        self.messages = [system_message]
        self.model = model
        self.bridge = InteractionBridge()
        self.event_queue = queue.Queue()
        self.worker = None
        self.result_holder = {}
        self.awaiting_answer = False
