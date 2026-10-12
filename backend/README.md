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

## Chat attachments and model selection

The standalone document library and indexing endpoints have been replaced by authenticated chat attachments.

- `POST /V1/attachments`: multipart upload, returns attachment metadata.
- `GET /V1/attachments/{id}/content`: authenticated original file download.
- `DELETE /V1/attachments/{id}`: removes an unsent draft attachment.
- `POST /V1/chat`: accepts `attachment_ids` alongside the message, session, and selected model.

The app supports six files per message, each up to 10 MB. Supported formats are PNG/JPEG/WebP/GIF images, PDF, DOCX, and UTF-8 text/Markdown/CSV/JSON/code files. PDF extraction requires readable text, at most 100 pages, and no encryption. Images are resized for the model; original files remain downloadable. Animated images are sent to the model as a single frame. Document text is capped at 300,000 characters with an explicit truncation notice. The model receives an initial excerpt and can read further portions using `read_chat_attachment`.

Attachments are bound to a conversation on send, restored as model context when a session resumes, and deleted when that conversation is deleted. Unsent attachments expire after one day. Uploaded file contents are reference data. The current operator authentication model remains in place.

The selected model is used by both the conversation and delegated research agent. Rate limits, provider credentials, context limits, and unsupported vision requests produce safe user-facing notices. Reset timing is shown only when provided; the app does not assume daily resets. Interrupted responses finish with an error and retain retry controls. SSE sends heartbeat comments and imposes a 180-second response deadline.

After deploying this update, restart/redeploy the Python backend as well as the frontend. Existing MongoDB data does not require a schema migration; the backend creates the `chat_attachments` collection and its indexes. Image interpretation requires a vision-capable upstream model.

### Regression checks

```bash
python -m pip install -r requirements-test.txt
python -m unittest discover -s tests -v
```

These checks use fixture repositories and model responses, not paid or live provider requests. Frontend browser checks run with `npm run test:ui` after installing Playwright Chromium.
