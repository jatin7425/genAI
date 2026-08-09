import queue
import threading
import uuid

from src.api.models.session import Session
from src.api.utils.sse import sse
from src.utils.interaction_bridge import set_bridge


class ChatService:
    """Business logic for a chat turn: session lookup, running the agent in a
    background thread, and streaming its events out as SSE.

    Every "thinking"/started/ended event is also pushed through the shared
    EventBroadcaster (tagged with session_id) so any other connected browser
    can show live progress for a conversation even if it didn't originate the
    request — not just the final saved result once it's done."""

    def __init__(self, agent, persona_service, broadcaster):
        self.agent = agent
        self.persona_service = persona_service
        self.broadcaster = broadcaster
        self._sessions = {}
        self._lock = threading.Lock()

    def _get_or_create_session(self, session_id, persona):
        with self._lock:
            if session_id not in self._sessions:
                prompt = self.persona_service.get_prompt(persona or "Default Assistant")
                system_message = self.agent.build_system_message(prompt)
                self._sessions[session_id] = Session(system_message)
            return self._sessions[session_id]

    @staticmethod
    def _rewind_last_user_turn(session):
        """Drop the last user message and everything after it (the previous,
        unwanted attempt) so the next message regenerates from that point
        instead of piling on top of stale context."""
        while session.messages and session.messages[-1]["role"] != "user":
            session.messages.pop()
        if session.messages and session.messages[-1]["role"] == "user":
            session.messages.pop()

    def _run_agent_worker(self, session, session_id):
        set_bridge(session.bridge)

        def on_event(kind, content):
            session.event_queue.put((kind, content))
            if kind == "thinking":
                self.broadcaster.broadcast("chat_thinking", {"session_id": session_id, "content": content})

        result = self.agent.run(session.messages, on_event=on_event, model=session.model)
        session.result_holder["result"] = result
        session.event_queue.put(("done", None))
        self.broadcaster.broadcast("chat_ended", {"session_id": session_id})

    def _stream(self, session, session_id):
        yield sse("session", {"session_id": session_id})

        # The job may have already finished (and its queue already drained by an
        # earlier, now-abandoned connection) before this generator started — e.g.
        # the client closed the tab and reopened it after the answer was ready.
        # Reattaching should still deliver that result instead of hanging forever.
        if "result" in session.result_holder and not (session.worker and session.worker.is_alive()):
            yield sse("done", session.result_holder["result"])
            return

        while True:
            try:
                kind, content = session.event_queue.get(timeout=0.1)
            except queue.Empty:
                if session.bridge.has_pending_question():
                    session.awaiting_answer = True
                    self.broadcaster.broadcast("chat_ended", {"session_id": session_id})
                    yield sse("question", {"question": session.bridge.question})
                    return
                if "result" in session.result_holder and not (session.worker and session.worker.is_alive()):
                    yield sse("done", session.result_holder["result"])
                    return
                continue

            if kind == "thinking":
                yield sse("thinking", {"content": content})
            elif kind == "done":
                yield sse("done", session.result_holder.get("result", {}))
                return

    def handle_message(self, session_id, message, persona, model=None, retry=False):
        session_id = session_id or str(uuid.uuid4())
        session = self._get_or_create_session(session_id, persona)

        already_running = session.worker is not None and session.worker.is_alive()

        if session.awaiting_answer:
            session.awaiting_answer = False
            session.bridge.answer_question(message)
            self.broadcaster.broadcast("chat_started", {"session_id": session_id})
        elif already_running:
            # A job for this session is still in flight (e.g. the caller navigated
            # away and back, or reconnected after a dropped connection) — reattach
            # to it instead of starting a second concurrent run on the same session.
            pass
        else:
            if model:
                session.model = model
            if retry:
                self._rewind_last_user_turn(session)
            session.messages.append({"role": "user", "content": message})
            session.result_holder.clear()
            worker = threading.Thread(target=self._run_agent_worker, args=(session, session_id), daemon=True)
            session.worker = worker
            self.broadcaster.broadcast("chat_started", {"session_id": session_id})
            worker.start()

        return session_id, self._stream(session, session_id)
