import json
import sys
import textwrap
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.utils import llm_client
from src.utils.common_tools import CommonTools
from src.agents.agent_factory import agentFactory


class orchestrator:
    def __init__(self, max_iterations=10):
        self.llm_client = llm_client.llmClient()
        self.agent_factory = agentFactory()
        self.common_tools = CommonTools()
        self.max_iterations = max_iterations

    def _tools(self):
        return self.agent_factory.agents_list() + CommonTools._tool() + [CommonTools.response_format()]

    def system_message(self, max_iterations, persona_prompt=None):
        base = textwrap.dedent(f"""\
            You are a helpful conversational assistant. For casual conversation,
            opinions, or anything you already know confidently, just answer
            directly — do not call a tool for that.

            You also have specialist agents and tools available for tasks that
            need current, specific, or checkable facts, or actions you can't do
            from knowledge alone. Delegate to them only when the task actually
            needs it. If a delegated agent's result is insufficient, adapt —
            rephrase the delegated task or delegate to a different agent —
            rather than repeating the same call. You have at most
            {max_iterations} tool-calling rounds; if you hit the limit without a
            confident answer, submit one anyway with confidence "low" rather
            than guessing silently.

            If you need clarification from the user, call ask_user with a
            single clear question and nothing else in that turn, then wait for
            their reply before continuing.

            When a task required tools or delegation, call submit_answer with
            your answer, the sources actually used, and your confidence, once
            you have enough information. Never fabricate answers, sources, or
            facts that didn't come from a delegated agent or tool result.
            """)
        if persona_prompt:
            return f"{persona_prompt.strip()}\n\n{base}"
        return base

    def build_system_message(self, persona_prompt=None, max_iterations=None):
        return {
            "role": "system",
            "content": self.system_message(max_iterations or self.max_iterations, persona_prompt),
        }

    def run(self, messages, max_iterations=None, on_event=None, model=None):
        if not max_iterations:
            max_iterations = self.max_iterations
        tools = self._tools()
        model = model or "nvidia"

        def emit(kind, content):
            if on_event:
                on_event(kind, content)

        for _ in range(max_iterations):
            response = self.llm_client.call_api("chat", {
                "model": model,
                "messages": messages,
                "tools": tools,
            })
            if "choices" not in response:
                return {"status": "error", "answer": None, "sources": [], "confidence": "low",
                        "note": f"LLM call failed: {response}"}
            message = response["choices"][0]["message"]
            messages.append(message)

            tool_calls = message.get("tool_calls")
            if not tool_calls:
                emit("answer", message.get("content"))
                return {"status": "done", "answer": message.get("content"), "sources": [], "confidence": "unknown"}

            for call in tool_calls:
                name = call["function"]["name"]
                args = json.loads(call["function"]["arguments"])

                if name == "submit_answer":
                    emit("answer", args.get("answer"))
                    return {"status": "done", **args}

                emit("thinking", f"Calling {name}({json.dumps(args)})")
                if name in self.agent_factory.agents_list_names():
                    result = self.agent_factory.call_agents(name, **args)
                elif name in self.common_tools.tool_list():
                    result = self.common_tools.call_tool(name, args)
                else:
                    result = {"error": f"unknown tool {name}"}
                emit("thinking", f"{name} → {json.dumps(result)[:500]}")

                messages.append({
                    "role": "tool",
                    "tool_call_id": call["id"],
                    "content": json.dumps(result),
                })

        return {"status": "max_iterations", "answer": None, "sources": [], "confidence": "low",
                "note": "max iterations reached"}


if __name__ == "__main__":
    agent = orchestrator()
    messages = [agent.build_system_message(), {"role": "user", "content": input("Task: ")}]
    result = agent.run(messages)
    print(json.dumps(result, indent=2))
