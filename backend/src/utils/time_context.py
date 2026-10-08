from datetime import datetime, timezone


def current_context_line() -> str:
    now = datetime.now(timezone.utc)
    return (
        f"Current date and time: {now.strftime('%A, %B %d, %Y, %H:%M')} UTC. "
        "Treat this as authoritative for anything time-relative (e.g. \"today\", "
        "\"this week\", how recent something is, date arithmetic). No local "
        "timezone is known for the user, so state times in UTC unless they say "
        "otherwise."
    )


def with_current_context(messages: list) -> list:
    """Returns a copy of `messages` with a live date/time line merged into the
    system message, without mutating the original (possibly persisted) list or
    message dict — the timestamp is only ever fresh for the single LLM call
    it's built for, never baked into saved conversation history."""
    context_line = current_context_line()
    if messages and messages[0].get("role") == "system":
        patched = dict(messages[0])
        patched["content"] = f"{patched.get('content', '')}\n\n{context_line}"
        return [patched] + messages[1:]
    return [{"role": "system", "content": context_line}] + messages
