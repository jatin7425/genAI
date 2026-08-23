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

    def __init__(self, agent, persona_service, broadcaster, conversation_service=None):
        self.agent = agent
        self.persona_service = persona_service
        self.broadcaster = broadcaster
        self.conversation_service = conversation_service
        self._sessions = {}
        self._lock = threading.Lock()

    def _get_or_create_session(self, session_id, persona, model=None):
        with self._lock:
            if session_id not in self._sessions:
                prompt = self.persona_service.get_prompt(persona or "Default Assistant")
                system_message = self.agent.build_system_message(prompt)
                session = Session(system_message)
                
                # Pre-fill memory from database if it exists
                if self.conversation_service:
                    try:
                        res = self.conversation_service.get_messages(session_id, skip=0, limit=100)
                        if res and res.get("items"):
                            # The API returns reverse-chronological by default usually (because it's for infinity scroll)?
                            # Let's ensure it's chronological for the prompt
                            # wait, repository.get_turns returns them sorted by index. 
                            # If it's a list, just map them
                            turns = res.get("items")
                            
                            if len(turns) > 15:
                                recent_turns = turns[-15:]
                                old_turns = turns[:-15]
                                
                                # Generate summary of old turns
                                summary_prompt = "Summarize the following conversation history briefly. Focus on key decisions, important facts established, and the user's main goals:\n\n"
                                for t in old_turns:
                                    role = "user" if t.get("kind") == "user" else "assistant"
                                    summary_prompt += f"{role}: {t.get('text', '')}\n\n"
                                
                                try:
                                    summary_res = self.agent.llm_client.call_api("chat", {
                                        "model": model or "groq",
                                        "messages": [{"role": "user", "content": summary_prompt}],
                                    })
                                    summary_text = summary_res.get("choices", [{}])[0].get("message", {}).get("content", "")
                                    if summary_text:
                                        session.messages.append({
                                            "role": "system",
                                            "content": f"Summary of earlier conversation (before the last 15 messages):\n{summary_text}"
                                        })
                                except Exception as e:
                                    import logging
                                    logging.warning(f"Failed to summarize older turns: {e}")
                            else:
                                recent_turns = turns

                            for turn in recent_turns:
                                role = "user" if turn.get("kind") == "user" else "assistant"
                                session.messages.append({"role": role, "content": turn.get("text", "")})
                    except Exception as e:
                        import logging
                        logging.warning(f"Could not load history for {session_id}: {e}")

                self._sessions[session_id] = session
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

        def on_token(chunk: str):
            session.event_queue.put(("token", chunk))

        extra_tools = []
        extra_tool_dispatch = {}

        if self.conversation_service:
            extra_tools.append({
                "type": "function",
                "function": {
                    "name": "search_current_chat",
                    "description": (
                        "Search the history of the CURRENT chat session for specific terms or context. "
                        "Useful if the user refers to something said much earlier in the conversation "
                        "that is no longer in your immediate context window."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string", "description": "The term or phrase to search for."}
                        },
                        "required": ["query"],
                    },
                }
            })
            
            def search_current_chat(query: str):
                import re
                try:
                    res = self.conversation_service.get_messages(session_id, skip=0, limit=1000)
                    turns = res.get("items", []) if res else []
                    matches = []
                    # Search case-insensitive
                    pattern = re.compile(re.escape(query), re.IGNORECASE)
                    for idx, turn in enumerate(turns):
                        text = turn.get("text", "")
                        if pattern.search(text):
                            role = turn.get("kind", "unknown")
                            matches.append(f"[{role}]: {text}")
                    if not matches:
                        return f"No matches found for '{query}' in the current chat."
                    return "\n\n---\n\n".join(matches)
                except Exception as e:
                    return f"Error searching chat: {e}"

            extra_tool_dispatch["search_current_chat"] = search_current_chat

        result = self.agent.run(
            session.messages,
            on_event=on_event,
            on_token=on_token,
            model=session.model,
            extra_tools=extra_tools,
            extra_tool_dispatch=extra_tool_dispatch
        )
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
            elif kind == "token":
                yield sse("token", {"content": content})
            elif kind == "done":
                yield sse("done", session.result_holder.get("result", {}))
                return

    def handle_message(self, session_id, message, persona, model=None, retry=False):
        session_id = session_id or str(uuid.uuid4())
        session = self._get_or_create_session(session_id, persona, model)

        already_running = session.worker is not None and session.worker.is_alive()

        if session.awaiting_answer:
            session.awaiting_answer = False
            session.bridge.answer_question(message)
            self.broadcaster.broadcast("chat_started", {"session_id": session_id})
        else:
            if already_running:
                # User sent a new message while the old one is still generating (interruption).
                # Abandon the old session object so the old worker doesn't pollute our new queue/messages.
                old_messages = list(session.messages)
                prompt = self.persona_service.get_prompt(persona or "Default Assistant")
                system_message = self.agent.build_system_message(prompt)
                new_session = Session(system_message)
                new_session.messages = old_messages
                with self._lock:
                    self._sessions[session_id] = new_session
                session = new_session

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
