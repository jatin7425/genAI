import json
import time

SUGGESTION_TOOL = {
    "type": "function",
    "function": {
        "name": "submit_suggestions",
        "description": "Submit exactly 3 varied, interesting conversation-starter suggestions for a chat assistant's empty state.",
        "parameters": {
            "type": "object",
            "properties": {
                "suggestions": {
                    "type": "array",
                    "minItems": 3,
                    "maxItems": 3,
                    "items": {
                        "type": "object",
                        "properties": {
                            "icon": {
                                "type": "string",
                                "description": (
                                    "A Material Symbols Outlined icon name, snake_case "
                                    "(e.g. 'travel_explore', 'insights', 'code')."
                                ),
                            },
                            "title": {"type": "string", "description": "Short 2-4 word title."},
                            "description": {"type": "string", "description": "One short sentence describing the prompt."},
                        },
                        "required": ["icon", "title", "description"],
                    },
                }
            },
            "required": ["suggestions"],
        },
    },
}

FALLBACK_SUGGESTIONS = [
    {
        "icon": "search_insights",
        "title": "Research AI trends",
        "description": "Summarize recent breakthroughs in LLM architectures.",
    },
    {
        "icon": "bar_chart",
        "title": "Analyze my data",
        "description": "Connect to database and run anomaly detection.",
    },
    {
        "icon": "route",
        "title": "Plan a travel route",
        "description": "Optimize a multi-city itinerary for efficiency.",
    },
]

CACHE_TTL_SECONDS = 10 * 60  # refresh suggestions at most once every 10 minutes


class SuggestionService:
    """Generates conversation-starter suggestions via a forced tool call —
    same function-calling pattern used everywhere else in this codebase for
    structured LLM output. Cached for CACHE_TTL_SECONDS so repeated "New
    Chat" screens/page loads don't hit the LLM (and its several-second-plus
    latency) every time; falls back to a static set on any failure so the
    empty-state screen never breaks."""

    def __init__(self, llm_client, model=None):
        self.llm_client = llm_client
        self.model = model or "nvidia"
        self._cache = None
        self._cached_at = 0

    def get_suggestions(self, force_refresh=False):
        if not force_refresh and self._cache is not None and (time.time() - self._cached_at) < CACHE_TTL_SECONDS:
            return self._cache

        suggestions = self._generate()
        self._cache = suggestions
        self._cached_at = time.time()
        return suggestions

    def _generate(self):
        try:
            response = self.llm_client.call_api("chat", {
                "model": self.model,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "Generate 3 short, varied, genuinely interesting conversation-starter "
                            "suggestions for an AI assistant's empty chat screen. Mix up the domains "
                            "(e.g. research, creative writing, technical/coding, planning, data "
                            "analysis, learning) each time — don't repeat the same themes every call. "
                            "Call submit_suggestions with exactly 3 entries."
                        ),
                    },
                ],
                "tools": [SUGGESTION_TOOL],
                "tool_choice": {"type": "function", "function": {"name": "submit_suggestions"}},
            })
            message = response["choices"][0]["message"]
            call = message["tool_calls"][0]
            args = json.loads(call["function"]["arguments"])
            suggestions = args.get("suggestions")
            if isinstance(suggestions, list) and len(suggestions) >= 3:
                return suggestions[:3]
        except Exception:
            pass
        return FALLBACK_SUGGESTIONS
