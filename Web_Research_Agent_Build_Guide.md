# Build Your Own: Web Research Agent

A task-driven agent (not a document Q&A bot): give it a task, it decides to search the web, scrape pages for real content, and reasons over what it finds — calling tools itself rather than you feeding it pre-retrieved context.

Runs on your existing LiteLLM proxy (`groq` / `gemini` pools both support tool calling — your OpenRouter pool is already tagged tool-calling-capable too).

Build order: get a single search tool working end-to-end first (small, testable milestone), then add scraping, then wire the full multi-step loop.

---

## 1. Architecture

```
User task ("What's the latest on X?")
        │
        ▼
  [1] Send task + tool definitions to LLM (via proxy)
        │
        ▼
  [2] LLM decides: answer directly, OR call a tool
        │
        ├── No tool call → done, return answer
        │
        └── Tool call (e.g. search_web("X latest news"))
                  │
                  ▼
          [3] Agent code executes the tool for real
                  │
                  ▼
          [4] Result appended to conversation as a "tool" message
                  │
                  ▼
          [5] Loop back to [1] with updated conversation
                  │
                  ▼
          (repeat — LLM may now call scrape_url() on a
           result, or search again, or finally answer)
```

This is the **ReAct / tool-calling agent** pattern: the LLM drives which tools get called and when, based on what it's seen so far. You're not doing retrieval yourself — you're giving it tools and letting it decide.

---

## 2. Tech stack

| Piece | Tool | Why |
|---|---|---|
| Web search | `ddgs` (`pip install ddgs`) | Free, no API key. Note: this package was renamed from `duckduckgo_search` — install `ddgs`, not the old name. |
| Page scraping | `requests` + `trafilatura` | `trafilatura` extracts clean article text from raw HTML (strips nav/ads/boilerplate) far better than manual BeautifulSoup text-dumping |
| LLM + tool calling | Your LiteLLM proxy, OpenAI SDK pointed at `localhost:4000` | Tool calling is the standard OpenAI `tools=[...]` format; LiteLLM normalizes it across Groq/Gemini/etc. |
| Loop control | Plain Python | No agent framework needed at this scale — a `while` loop is clearer than LangChain/CrewAI for a first build |

```
pip install ddgs requests trafilatura openai
```

[ddgs on PyPI](https://pypi.org/project/ddgs/) · [LiteLLM function calling docs](https://docs.litellm.ai/docs/completion/function_call)

---

## 3. Step-by-step build

### Step 1 — Search tool as a plain function (test in isolation first)

Before touching the LLM at all, write and test:

```
from ddgs import DDGS

def search_web(query: str, max_results: int = 5):
    with DDGS() as ddgs:
        results = ddgs.text(query, max_results=max_results)
    return [{"title": r["title"], "url": r["href"], "snippet": r["body"]} for r in results]
```

Run it directly with a test query and print the output. Confirm it returns real results before moving on — debugging this separately from the LLM loop saves a lot of confusion later.

### Step 2 — Describe the tool to the LLM

Tool calling needs a JSON schema describing the function, so the model knows it exists and what arguments to pass:

```
tools = [
    {
        "type": "function",
        "function": {
            "name": "search_web",
            "description": "Search the web for current information on a topic.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search query"},
                },
                "required": ["query"],
            },
        },
    }
]
```

### Step 3 — First milestone: one tool call, no loop yet

Send a task to the LLM with just this one tool and see if it decides to use it:

```
from openai import OpenAI
client = OpenAI(base_url="http://localhost:4000", api_key="anything")

messages = [{"role": "user", "content": "What's new in the AI space this week?"}]

response = client.chat.completions.create(
    model="groq",
    messages=messages,
    tools=tools,
    tool_choice="auto",
)

msg = response.choices[0].message
if msg.tool_calls:
    print(msg.tool_calls)  # inspect what the model wants to call
```

At this point don't even execute the tool yet — just confirm the model is choosing to call `search_web` with sensible arguments. That's the "first piece" working.

### Step 4 — Actually execute the tool and feed the result back

```
import json

tool_call = msg.tool_calls[0]
args = json.loads(tool_call.function.arguments)
result = search_web(**args)

messages.append(msg)  # the assistant's tool-call message
messages.append({
    "role": "tool",
    "tool_call_id": tool_call.id,
    "content": json.dumps(result),
})

# call the model again with the tool result now in context
response = client.chat.completions.create(model="groq", messages=messages, tools=tools)
print(response.choices[0].message.content)
```

At this point you have a working single-round tool-use agent: task → search → answer.

### Step 5 — Add the scrape tool

Search results only give snippets. To actually read a page:

```
import requests, trafilatura

def scrape_url(url: str) -> str:
    downloaded = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"}).text
    text = trafilatura.extract(downloaded) or ""
    return text[:4000]  # truncate — don't blow up the context window
```

Add a matching tool schema (same shape as Step 2, one `url` parameter) and append it to the same `tools` list. Now the model can choose between `search_web` and `scrape_url` on each turn.

### Step 6 — The real loop

Wrap Steps 3-5 in a `while` loop instead of doing it once:

```
MAX_ITERATIONS = 6

for _ in range(MAX_ITERATIONS):
    response = client.chat.completions.create(model="groq", messages=messages, tools=tools)
    msg = response.choices[0].message
    messages.append(msg)

    if not msg.tool_calls:
        break  # model gave a final answer, no more tools needed

    for tool_call in msg.tool_calls:
        args = json.loads(tool_call.function.arguments)
        if tool_call.function.name == "search_web":
            result = search_web(**args)
        elif tool_call.function.name == "scrape_url":
            result = scrape_url(**args)
        else:
            result = {"error": "unknown tool"}

        messages.append({
            "role": "tool",
            "tool_call_id": tool_call.id,
            "content": json.dumps(result),
        })

print(msg.content)  # final answer
```

This is the core of the agent: search → pick promising results → scrape → maybe search again → answer. The `MAX_ITERATIONS` cap is important — without it, a model that keeps calling tools never terminates.

### Step 7 — Track and show sources

Every time `search_web` or `scrape_url` runs, log the URL to a `sources` list. When the loop ends, print/display that list alongside the answer — makes the agent's reasoning verifiable instead of a black box.

---

## 4. Suggested file layout

```
web-agent/
├── requirements.txt
├── tools.py       ← search_web(), scrape_url(), tool schemas
├── agent.py        ← the loop from Step 6
└── main.py         ← CLI entry point: takes a task, runs agent.py, prints answer + sources
```

---

## 5. Common pitfalls

- **`pip install duckduckgo_search` is the old name** — use `pip install ddgs`, the import is `from ddgs import DDGS`.
- **DuckDuckGo rate limits** — it's an unofficial wrapper around the DDG HTML interface, not a real API. Hammering it quickly can get you temporarily blocked. Add a short delay between searches if you're iterating a lot.
- **Infinite tool-call loops** — always enforce `MAX_ITERATIONS`. Some models will keep searching instead of committing to an answer.
- **Malformed tool-call arguments** — `tool_call.function.arguments` is a JSON *string* generated by the model; wrap `json.loads()` in a try/except, models occasionally emit invalid JSON.
- **Context blowup** — scraped page text can be huge; always truncate (Step 5 caps at 4000 chars) or you'll blow past context limits or burn your free-tier quota fast.
- **Not every pool model supports tool calling well** — Groq's `llama-3.3-70b-versatile` and Gemini 2.5 Flash both do reliably; if you fall back to `aion-2.0` or others, verify they support the `tools` parameter before relying on them in the fallback chain.

---

## 6. Stretch goals

- **Parallel tool calls**: some models return multiple `tool_calls` in one response — the loop above already handles a list, but test that your chosen model actually batches them.
- **Fallback chain**: `model=["groq", "gemini"]` so a rate-limited pool doesn't kill the whole run.
- **Show its reasoning**: print each tool call and result as it happens (a visible "Thought → Action → Observation" trace) instead of only the final answer — much easier to debug and more satisfying to watch.
- **More tools**: a calculator, a "save to file" tool, or a second search provider (Google Custom Search API) as a fallback when DuckDuckGo is rate-limited.
- **Respect robots.txt** if you extend this beyond personal use — `scrape_url` above doesn't check it.

---

Start with Step 1-3 only — a working "model decides to search, prints what it would call" — before writing the loop. Confirming the model actually invokes the tool correctly is the part most likely to surprise you (prompt wording affects this more than you'd expect).

Sources:
- [ddgs on PyPI](https://pypi.org/project/ddgs/)
- [LiteLLM Function Calling docs](https://docs.litellm.ai/docs/completion/function_call)
