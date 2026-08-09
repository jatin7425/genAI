import contextvars
import threading

_current_bridge = contextvars.ContextVar("interaction_bridge", default=None)


class InteractionBridge:
    """Lets ask_user() block a worker thread on a question until the UI thread supplies an answer."""

    def __init__(self):
        self.question = None
        self.answer = None
        self._question_ready = threading.Event()
        self._answer_ready = threading.Event()

    def ask(self, question):
        self.question = question
        self.answer = None
        self._answer_ready.clear()
        self._question_ready.set()
        self._answer_ready.wait()
        self._question_ready.clear()
        return self.answer

    def has_pending_question(self):
        return self._question_ready.is_set()

    def answer_question(self, answer):
        self.answer = answer
        self._answer_ready.set()


def set_bridge(bridge):
    _current_bridge.set(bridge)


def get_bridge():
    return _current_bridge.get()
