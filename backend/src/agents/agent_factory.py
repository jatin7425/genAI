
from src.agents.web_search_agent import WebSearchAgent


class agentFactory:
    def __init__(self):
        self.web_search_agent = WebSearchAgent()

    def agents_list(self):
        return [
            {
                "type": "function",
                "function": {
                    "name": "web_search_agent",
                    "description": (
                        "Delegate a task to a research agent that searches the web and "
                        "verifies information before answering. Use this when the task "
                        "requires current, specific, or checkable facts that you shouldn't "
                        "answer from assumption alone. Returns a dict with 'answer', "
                        "'sources' (URLs actually used), and 'confidence'."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The task or question to research, phrased as a clear instruction or question.",
                            },
                            "max_iterations": {
                                "type": "integer",
                                "description": "Maximum tool-calling rounds the agent may use before it must submit an answer.",
                                "default": 10,
                            },
                        },
                        "required": ["query"],
                    },
                },
            },
        ]

    def agents_list_names(self):
        return [tool["function"]["name"] for tool in self.agents_list()]

    def call_agents(self, name, **args):
        mapping = {
            "web_search_agent": self.web_search_agent.web_search_agent,
        }

        if name not in mapping:
            raise ValueError(f"Unknown agent '{name}'. Available agents: {self.agents_list()}")

        return mapping[name](**args)