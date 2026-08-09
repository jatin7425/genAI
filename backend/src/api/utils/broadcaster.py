import queue
import threading

from src.api.utils.sse import sse


class EventBroadcaster:
    """In-memory pub-sub shared by any service that wants to push live events
    to every connected browser (conversation changes, chat progress, ...).
    One SSE endpoint (/V1/conversations/stream) drains this for all of them —
    no need for a separate persistent connection per event type."""

    def __init__(self):
        self._subscribers = []
        self._lock = threading.Lock()

    def subscribe(self):
        q = queue.Queue()
        with self._lock:
            self._subscribers.append(q)
        return q

    def unsubscribe(self, q):
        with self._lock:
            if q in self._subscribers:
                self._subscribers.remove(q)

    def broadcast(self, event, data):
        with self._lock:
            subscribers = list(self._subscribers)
        for q in subscribers:
            q.put((event, data))

    def stream(self):
        q = self.subscribe()
        try:
            while True:
                try:
                    event, data = q.get(timeout=15)
                except queue.Empty:
                    yield ": keepalive\n\n"  # comment line — keeps idle proxies from closing the connection
                    continue
                yield sse(event, data)
        finally:
            self.unsubscribe(q)
