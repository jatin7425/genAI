import json
import sys
import textwrap
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.utils import llm_client
from src.utils.web_search import webSearch
from src.utils.common_tools import CommonTools

class WebSearchAgent:
    def __init__(self, max_iterations=10):
        self.llm_client = llm_client.llmClient()
        self.web_search = webSearch()
        self.common_tools = CommonTools()
        self.max_iterations = max_iterations

    def _tool(self):
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "duckduckgo_search",
                    "description": (
                        "Search the web for current information on a topic. Returns a list "
                        "of results, each with a title, link, and short snippet. Use this to "
                        "discover relevant pages across the web when you don't yet have a "
                        "specific URL to look at."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The search query, phrased like a real search engine query.",
                            },
                            "max_results": {
                                "type": "integer",
                                "description": "Maximum number of results to return.",
                                "default": 10,
                            },
                        },
                        "required": ["query"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "search_engine",
                    "description": (
                        "Check how relevant a specific, already-known web page is to a set of "
                        "query terms, by counting how often those terms (or close word variants) "
                        "appear on the page. Returns a dictionary mapping each matched query term "
                        "to its occurrence count. This is a keyword-frequency check on ONE page, "
                        "not a web-wide search — use duckduckgo_search first to find candidate "
                        "URLs, then use this to decide which of those pages is worth reading in "
                        "full. It will not find synonyms or related concepts, only near-exact word "
                        "matches after stemming."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "url": {
                                "type": "string",
                                "description": "Full URL of the page to analyze, e.g. https://example.com/article",
                            },
                            "query": {
                                "type": "string",
                                "description": "The terms to check for relevance on this page.",
                            },
                        },
                        "required": ["url", "query"],
                    },
                },
            },
            CommonTools()._tool()[0],  # call_api
        ]
        return tools

    def system_message(self, max_iterations=6):
        return textwrap.dedent(f"""\
            You are a research agent that answers tasks by using tools to find
            and verify current information. Don't answer from assumption when the
            question involves facts that could be outdated, specific, or checkable.

            Tools available:
            - duckduckgo_search(query, max_results): find candidate pages on a topic.
            - search_engine(url, query): check how much a specific already-found page
            actually discusses your query terms before treating it as reliable.

            Only call a tool when you need new information. If a tool call fails or
            returns nothing useful, adapt — reworded query or different URL — rather
            than repeating the same call. You have at most {max_iterations} tool-calling
            rounds; if you hit the limit without a confident answer, submit one anyway
            with confidence "low" rather than guessing silently.

            When you have enough information, call submit_answer with your answer,
            the URLs you actually used, and your confidence. Never fabricate URLs,
            titles, or facts that didn't come from a tool result.
            """)

    def web_search_agent(self,query, max_iterations=None):
        if not max_iterations:
            max_iterations = self.max_iterations
        tools = self._tool() + [CommonTools().response_format()]
        messages = [
            {"role": "system", "content": self.system_message(max_iterations)},
            {"role": "user", "content": query},
        ]

        for _ in range(max_iterations):
            response = self.llm_client.call_api("chat", {
                "model": "nvidia",
                "messages": messages,
                "tools": tools,
            })
            if "choices" not in response:
                return {"answer": None, "sources": [], "confidence": "low",
                        "note": f"LLM call failed: {response}"}
            message = response["choices"][0]["message"]
            messages.append(message)

            tool_calls = message.get("tool_calls")
            if not tool_calls:
                # model answered in free text instead of calling submit_answer — treat as fallback
                return {"answer": message.get("content"), "sources": [], "confidence": "unknown"}

            print(f"message: {json.dumps(message, indent=2, default=str)}")
            print("\n\n\n")
            for call in tool_calls:
                name = call["function"]["name"]
                args = json.loads(call["function"]["arguments"])

                if name == "submit_answer":
                    return args
                elif name == "duckduckgo_search":
                    result = self.web_search.duckduckgo_search(**args)
                elif name == "search_engine":
                    result = self.web_search.search_engine(**args) or {"error": "failed to fetch page"}
                elif name in self.common_tools.tool_list():
                    result = CommonTools().call_tool(name, args)
                else:
                    result = {"error": f"unknown tool {name}"}
                print(f"Tool {name} returned: {json.dumps(result, indent=2, default=str)}")
                print("\n\n\n")
                messages.append({
                    "role": "tool",
                    "tool_call_id": call["id"],
                    "content": json.dumps(result),
                })

        return {"answer": None, "sources": [], "confidence": "low", "note": "max iterations reached"}
