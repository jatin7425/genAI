# Build Your Own: RAG Chatbot ("Chat With Your Documents")

A weekend-mini project: a chatbot that answers questions using your own PDFs, Word docs, and notes.

Updated for your setup: you're running a **LiteLLM proxy** with pools of free-tier cloud models (Gemini, Groq, Aion, OpenRouter, NVIDIA NIM), each pool load-balanced across multiple API keys. That replaces Ollama as the generation backend — embeddings still run locally (cheap, no reason to send those to an API), but answers come from whichever cloud model LiteLLM routes to. Your GPU/CPU specs stop being a constraint since generation isn't happening on your machine anymore.

---

## 1. Architecture

```
Your documents (PDF/DOCX/TXT/MD)
        │
        ▼
  [1] Chunk text into ~800-char pieces
        │
        ▼
  [2] Embed each chunk (sentence-transformers, runs on CPU)
        │
        ▼
  [3] Store vectors in a FAISS index (on disk)

At chat time:
  Your question
        │
        ▼
  [4] Embed the question the same way
        │
        ▼
  [5] Search FAISS for the top-k most similar chunks
        │
        ▼
  [6] Stuff those chunks + your question into a prompt
        │
        ▼
  [7] Send prompt to a local LLM (via Ollama) → answer
        │
        ▼
  [8] Display answer + which sources it came from (Streamlit UI)
```

This is Retrieval-Augmented Generation (RAG): the LLM never "knows" your documents — you retrieve the relevant pieces and hand them to it fresh every time.

---

## 2. Tech stack

| Piece | Tool | Why |
|---|---|---|
| Embeddings | `sentence-transformers` (`all-MiniLM-L6-v2`) | Small (~80MB), fast on CPU, keeps embedding calls out of your rate-limited pools |
| Vector store | `faiss-cpu` | Local, no server, handles thousands of chunks instantly |
| LLM | Your LiteLLM proxy (`gemini` / `groq` / `aion-2.0` / `openrouter` / `nvidia` pools) | Free-tier, already load-balanced across multiple keys |
| File parsing | `pypdf`, `python-docx` | Standard, reliable |
| UI | `streamlit` | A working chat UI in ~40 lines |

### Which pool to point the chatbot at?

Your config exposes these `model_name` values through the proxy — this is what you pass as `model` in requests, not the underlying provider model string:

- **`groq`** — Llama 3.3 70B, fast inference, 7 keys in rotation → good default for interactive chat
- **`gemini`** — Gemini 2.5 Flash, 6 keys in rotation → strong general quality, good fallback
- **`openrouter`** / **`nvidia`** / **`aion-2.0`** — smaller RPM caps (14-40/min), fine as secondary pools or for a router/fallback chain

For a RAG chatbot, `groq` or `gemini` as the primary model is the simplest starting point — both have deep key pools so you're unlikely to hit rate limits during a demo.

---

## 3. Step-by-step build

### Step 0 — Environment setup

1. Make sure your LiteLLM proxy is running against your `config.yaml`:
   ```
   litellm --config config.yaml --port 4000
   ```
   This exposes an OpenAI-compatible endpoint at `http://localhost:4000`.
2. Create a Python virtual environment and install:
   ```
   pip install sentence-transformers faiss-cpu pypdf python-docx streamlit openai numpy tqdm
   ```
   (`openai` package here is just the client library — LiteLLM's proxy speaks the OpenAI API format, so the official `openai` SDK works against it by pointing `base_url` at your proxy.)

### Step 1 — Document loading

Write a function per file type that returns raw text:
- `.pdf` → loop `pypdf.PdfReader(path).pages`, call `.extract_text()` on each
- `.docx` → `python-docx`, join `paragraph.text` for each paragraph
- `.txt` / `.md` → just read the file

Wrap them behind one `load_file(path)` that dispatches on extension.

### Step 2 — Chunking

Don't embed whole documents — split into overlapping windows so context isn't lost at boundaries.

- Chunk size: ~800 characters
- Overlap: ~150 characters (so a sentence split across two chunks still appears whole in at least one)
- Simple approach: slide a window across the normalized text (`" ".join(text.split())` to collapse whitespace first)

Store each chunk alongside its source filename and chunk index — you'll want to cite sources later.

### Step 3 — Embedding + index build

```
model = SentenceTransformer("all-MiniLM-L6-v2")
vectors = model.encode(chunk_texts, normalize_embeddings=True)
```

Normalizing embeddings lets you use inner product as cosine similarity — simpler and faster in FAISS:

```
index = faiss.IndexFlatIP(vectors.shape[1])
index.add(vectors)
faiss.write_index(index, "index.faiss")
```

Also pickle/save the list of `{text, source, chunk_id}` records in the same order — FAISS only stores vectors, so you need a parallel lookup to go from "result #7" back to its text.

This whole step is a standalone script (e.g. `ingest.py`) you rerun whenever your documents change.

### Step 4 — Retrieval

At query time:
```
q_vector = model.encode([question], normalize_embeddings=True)
scores, ids = index.search(q_vector, k=4)   # top 4 chunks
```
Look up the corresponding records for those `ids` — that's your retrieved context.

### Step 5 — Prompting via your LiteLLM proxy

Build a prompt (or system message) that clearly separates context from instructions, e.g.:

```
Answer the question using ONLY the context below. If the answer isn't
in the context, say you don't know.

Context:
{chunk 1 text}
---
{chunk 2 text}
---
...

Question: {user question}
```

Call your proxy using the OpenAI SDK pointed at `localhost:4000` — this is the standard chat completions shape, and LiteLLM handles routing to whichever key in the pool is available:

```
from openai import OpenAI

client = OpenAI(base_url="http://localhost:4000", api_key="anything")  # proxy handles real auth

response = client.chat.completions.create(
    model="groq",   # or "gemini", "openrouter", "nvidia", "aion-2.0"
    messages=[
        {"role": "system", "content": "Answer using ONLY the provided context."},
        {"role": "user", "content": prompt_with_context},
    ],
)
answer = response.choices[0].message.content
```

If your proxy config has a `master_key` / `litellm_settings` auth requirement, use that as `api_key` instead of a placeholder. Since each `model_name` pool has multiple keys behind it, a single call here will transparently fail over/rotate if one key is rate-limited.

### Step 6 — Streamlit chat UI

Core pieces:
- `st.session_state` to hold chat history across reruns
- `st.chat_input()` for the question box
- `st.chat_message()` to render each turn
- On each new question: embed → retrieve → build prompt → call your LiteLLM proxy → display answer, and show the source filenames used (builds trust, easy to verify)

That's the entire app — realistically 40-60 lines once ingestion is a separate script.

---

## 4. Suggested file layout

```
rag-chatbot/
├── requirements.txt
├── docs/              ← drop your PDFs/notes here
├── ingest.py          ← Steps 1-3: builds index/ from docs/
├── app.py             ← Steps 4-6: Streamlit chat UI
└── index/             ← generated: index.faiss + metadata
```

Run order: `python ingest.py` once (or whenever docs change), then `streamlit run app.py`.

---

## 5. Stretch goals (once the basic version works)

- **Show confidence**: if the top retrieval score is low, have the bot say "I couldn't find this in your documents" instead of guessing.
- **Conversation memory**: pass recent chat turns into the prompt so follow-up questions work.
- **Reranking**: after FAISS retrieves top-20, use a small cross-encoder to rerank down to top-4 for better precision.
- **Hybrid search**: combine vector search with simple keyword (BM25) search for names/numbers that embeddings sometimes miss.
- **Fallback chain**: pass `model=["groq", "gemini", "nvidia"]` (a list) instead of a single pool name — LiteLLM will try them in order if one pool is fully rate-limited.
- **Track usage per pool**: LiteLLM proxy has a `/spend` and request-logging API — useful to see which keys/pools are getting hit hardest during testing.

---

## 6. Common pitfalls

- **Empty PDF text**: some PDFs are scanned images — `pypdf` returns nothing. You'd need OCR (e.g. `pytesseract`) for those.
- **Proxy not running**: the OpenAI client call fails if `litellm --config config.yaml` isn't up. Check `http://localhost:4000/health` in a browser.
- **429 / rate-limit errors**: even with key rotation, all keys in a pool can be exhausted at once (e.g. `aion-2.0` at 14 rpm × 8 keys = 112 rpm ceiling). Use the fallback-chain pattern above, or catch the error and retry against a different pool.
- **Wrong model name**: pass the `model_name` from your YAML (`groq`, `gemini`, etc.), not the underlying provider string (`groq/llama-3.3-70b-versatile`) — the proxy does that mapping for you.
- **Chunk size too big/small**: too big → irrelevant text dilutes the answer; too small → context gets fragmented. 600-1000 characters is a good starting range.
- **Forgetting to normalize embeddings** when using `IndexFlatIP` — without normalization, inner product isn't equivalent to cosine similarity and results degrade.

---

Build order recommendation: get `ingest.py` working first and confirm you can print out retrieved chunks for a test question before wiring up the LLM or UI. Debugging retrieval separately from generation saves a lot of confusion.
