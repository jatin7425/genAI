import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from src.db import get_db
from src.migrations.remove_companions import purge_retired_data

from src.config import CONFIG
from src.api import api_router

# The API runs headless — ask_user() must go through the interaction bridge, not input().
CONFIG.setdefault("flags", {})["is_terminal"] = False

@asynccontextmanager
async def lifespan(app):
    dropped = await run_in_threadpool(purge_retired_data, get_db())
    if dropped:
        logging.info("Removed retired feature collections: %s", ", ".join(dropped))
    yield


app = FastAPI(title="genAI Chat API", lifespan=lifespan)

# The deployed frontend's origin (e.g. https://your-app.vercel.app) — not a
# localhost/127.0.0.1 port, so it needs to be explicitly allow-listed on top
# of the dev-server regex below.
_frontend_origin = os.getenv("FRONTEND_ORIGIN")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://gen-ai-delta-three.vercel.app"],
    # matches any port on localhost/127.0.0.1 so the Vite dev server's auto-picked
    # port (5173, 5174, 5180, ...) is always allowed without hardcoding a list
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}


app.include_router(api_router)
