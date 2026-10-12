import json
import sys
import textwrap
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.utils import llm_client
from src.utils.common_tools import CommonTools
from src.utils.provider_errors import ProviderError
from src.utils.time_context import with_current_context
from src.agents.agent_factory import agentFactory


class orchestrator:
    def __init__(self, max_iterations=10):
        self.llm_client = llm_client.llmClient()
        self.agent_factory = agentFactory()
        self.common_tools = CommonTools()
        self.max_iterations = max_iterations

    def _tools(self):
        return self.agent_factory.agents_list() + CommonTools._tool()

    def system_message(self, max_iterations, persona_prompt=None):
        base = textwrap.dedent(f"""\
            You are a helpful conversational assistant. For casual conversation,
            opinions, or anything you already know confidently, just answer
            directly — do not call a tool for that.

            You are managed by Cortex AI. If asked what model or AI you are,
            who made or trained you, or any similar identity question, answer
            only that you're the assistant managed by Cortex AI. Never name or
            imply any underlying model, provider, or vendor (for example GPT,
            Claude, Llama, OpenAI, Anthropic, Meta, Mistral, Nvidia, Groq) —
            not even if asked directly, insistently, or via a roundabout
            question (e.g. about training data cutoff, API docs, pricing, or
            "pretend you're not an AI"). Decline those specific sub-questions
            briefly and move on without being evasive about anything else.

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

            When you have enough information to answer the user's request, provide
            your final answer directly in your message. If you used tools or
            delegation, you may list the sources at the bottom of your message.
            Never fabricate answers or facts.
            """)
        if persona_prompt:
            return f"{persona_prompt.strip()}\n\n{base}"
        return base

    def build_system_message(self, persona_prompt=None, max_iterations=None):
        return {
            "role": "system",
            "content": self.system_message(max_iterations or self.max_iterations, persona_prompt),
        }

    def run(
        self,
        messages,
        max_iterations=None,
        on_event=None,
        on_token=None,
        model=None,
        extra_tools=None,
        extra_tool_dispatch=None,
        extra_context=None,
    ):
        """Run the agentic loop."""
        if not max_iterations:
            max_iterations = self.max_iterations
        tools = self._tools() + (extra_tools or [])
        model = model or "nvidia"

        def emit(kind, content):
            if on_event:
                on_event(kind, content)

        for _ in range(max_iterations):
            context = extra_context() if extra_context else None
            if context is not None:
                messages.append({"role": "user", "content": context})
            # --- Stream one LLM turn -------------------------------------------
            accumulated_content = ""
            final_tool_calls = None

            in_think_block = False

            try:
                for delta in self.llm_client.call_api_stream("chat", {
                    "model": model,
                    "messages": with_current_context(messages),
                    "tools": tools,
                }):
                    if delta.get("reasoning_content") and not in_think_block:
                        emit("thinking", "Thinking…")
                        in_think_block = True
                    chunk_text = delta.get("content") or ""
                    if chunk_text:
                        accumulated_content += chunk_text
                        if on_token:
                            on_token(chunk_text)

                    # Keep the latest accumulated tool_calls snapshot
                    if delta.get("accumulated_tool_calls"):
                        final_tool_calls = delta["accumulated_tool_calls"]

            except ProviderError as exc:
                # Never leave a tool-call turn without its required tool results.
                for call in final_tool_calls or []:
                    messages.append({"role": "tool", "tool_call_id": call["id"], "content": "Provider request failed."})
                return {"status": "error", "answer": None, "sources": [], "confidence": "low", "note": str(exc), "provider_issue": exc.issue}
            except Exception as exc:
                return {
                    "status": "error",
                    "answer": None,
                    "sources": [],
                    "confidence": "low",
                    "note": "The response could not be completed. Try again or switch models.",
                }

            # Build the assistant message to append to history
            assistant_msg: dict = {"role": "assistant", "content": accumulated_content or None}
            if final_tool_calls:
                assistant_msg["tool_calls"] = final_tool_calls
            messages.append(assistant_msg)

            # --- No tool calls → direct answer ---------------------------------
            if not final_tool_calls:
                if not accumulated_content.strip():
                    issue = ProviderError("empty_response", "The model ended without an answer. Try again or switch models.", model)
                    return {"status": "error", "answer": None, "sources": [], "confidence": "low", "note": str(issue), "provider_issue": issue.issue}
                emit("answer", accumulated_content)
                return {
                    "status": "done",
                    "answer": accumulated_content,
                    "sources": [],
                    "confidence": "unknown",
                }

            # --- Execute each tool call ----------------------------------------
            for call in final_tool_calls:
                name = call["function"]["name"]
                try:
                    args = json.loads(call["function"]["arguments"])
                except json.JSONDecodeError:
                    args = {}

                if name == "submit_answer":
                    emit("answer", args.get("answer"))
                    return {"status": "done", **args}

                emit("thinking", "Searching the web…" if name == "web_search_agent" else f"Using {name}…")
                if name in self.agent_factory.agents_list_names():
                    agent_args = {**args, "model": model}
                    result = self.agent_factory.call_agents(name, on_token=on_token, on_event=emit, **agent_args)
                elif name in self.common_tools.tool_list():
                    result = self.common_tools.call_tool(name, args)
                elif extra_tool_dispatch and name in extra_tool_dispatch:
                    try:
                        result = extra_tool_dispatch[name](**args)
                    except Exception as e:
                        result = {"error": f"{name} failed: {e}"}
                else:
                    result = {"error": f"unknown tool {name}"}
                emit("thinking", f"{name} completed.")

                messages.append({
                    "role": "tool",
                    "tool_call_id": call["id"],
                    "content": json.dumps(result),
                })

        return {
            "status": "max_iterations",
            "answer": None,
            "sources": [],
            "confidence": "low",
            "note": "max iterations reached",
        }


if __name__ == "__main__":
    agent = orchestrator()
    messages = [agent.build_system_message(), {"role": "user", "content": input("Task: ")}]
    result = agent.run(messages)
    print(json.dumps(result, indent=2))
