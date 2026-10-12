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


## Personas, titles, and memory

Existing personas can be edited from Settings or the chat persona menu, including the default persona. Names remain stable so saved conversations keep their persona reference. `GET /V1/personas/{name}` loads instructions; `PUT` updates them. Empty instructions are rejected; missing personas return 404. Changes apply on the next turn.

After a first completed question/reply pair is saved, the selected chat model generates a short title in a background worker. A fallback title appears immediately; provider failures do not block chat. Generated titles are retained on later saves and streamed to navigation. Each conversation retains its own persisted history, including older pages, and restores only its own context when resumed.

Shared user memory is persisted in MongoDB's `user_memory` collection as user-scoped key/value entries (unique user/key index). The existing login supports one operator; `AUTH_USERNAME` identifies that operator. The assistant can remember stable user-stated details with `remember_user_detail`, read current details, and forget requested keys. Shared facts are refreshed before each new turn across all sessions/personas. Conversation content and attachment text are not automatically copied to global memory.

Settings provides add/edit/delete/clear controls. Authenticated endpoints: `GET /V1/memory`, `PUT /V1/memory/{key}`, `DELETE /V1/memory/{key}`, and `DELETE /V1/memory`. Values are text, keys are at most 100 characters, values at most 2000 characters, with at most 100 entries per operator. Clearing shared memory does not delete session histories, and deleting a session does not clear shared memory. Redeploy the Python backend and frontend to enable these changes.
