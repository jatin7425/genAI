# genAI

An agentic chat backend: an orchestrator agent that either answers directly or delegates
to specialist agents/tools (web search, HTTP calls, clarifying questions), exposed over a
streaming FastAPI API with persona support.

## Setup

From the `backend/` directory:

```bash
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

pip install -r requirements.txt
```

Create your `.env` from the example and fill in your LLM credentials:

```bash
cp .env.example .env
```

```
LITELLM_MASTER_KEY=your-key-here
LITELLM_BASE_URL=your-litellm-base-url
```

## Run

The app must run with `backend`'s **parent** directory on the Python path, since all
internal imports are `src...`. Run it from the project root (one level above
`backend/`):

```bash
cd ..
uvicorn main:app --reload
```