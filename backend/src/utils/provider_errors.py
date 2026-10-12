import json
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime


class ProviderError(Exception):
    def __init__(self, code, message, model=None, retry_after_seconds=None):
        super().__init__(message)
        self.issue = {"code": code, "message": message, "model": model, "retry_after_seconds": retry_after_seconds}


def provider_error(status, body, headers=None, model=None):
    """Classify provider/gateway errors without leaking raw responses or credentials."""
    headers = headers or {}
    details = json.dumps(body).lower()
    delay = None
    retry = headers.get("Retry-After") or headers.get("retry-after")
    if retry:
        try:
            delay = max(1, int(float(retry)))
        except (ValueError, TypeError):
            try:
                delay = max(1, int((parsedate_to_datetime(retry) - datetime.now(timezone.utc)).total_seconds()))
            except (ValueError, TypeError, OverflowError):
                pass
    exhausted_pool = isinstance(body, dict) and body.get("error") == "no healthy upstreams" and body.get("tried") == []
    if exhausted_pool:
        delay = delay or 60
    if status == 402 or status == 429 or exhausted_pool or any(word in details for word in ("insufficient_quota", "resource_exhausted", "rate_limit", "quota exceeded", "credit balance", "upstream 429")):
        message = "You’ve reached this provider’s limit. Switch models or try again later."
        if delay:
            message = f"You’ve reached this provider’s limit. Try again in about {delay} seconds, or switch models."
        return ProviderError("provider_limit", message, model, delay)
    if status in (401, 403) or "upstream 401" in details or "upstream 403" in details:
        return ProviderError("provider_auth", "This provider’s credentials are expired, invalid, or missing access. Switch models or update the provider credentials.", model)
    if status in (400, 415, 422) and any(word in details for word in ("image", "vision", "multimodal")):
        return ProviderError("vision_unsupported", "This model cannot process the attached image. Choose a model that supports vision and retry.", model)
    if status in (400, 413, 422) and any(word in details for word in ("context", "token", "too large")):
        return ProviderError("context_limit", "This conversation is too large for the selected model. Try a model with a larger context window or start a new chat.", model)
    return ProviderError("provider_unavailable", "This model’s provider is unavailable right now. Try again or switch models.", model)
