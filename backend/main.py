from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import CONFIG
from src.api import api_router

# The API runs headless — ask_user() must go through the interaction bridge, not input().
CONFIG.setdefault("flags", {})["is_terminal"] = False

app = FastAPI(title="genAI Chat API")

app.add_middleware(
    CORSMiddleware,
    # matches any port on localhost/127.0.0.1 so the Vite dev server's auto-picked
    # port (5173, 5174, 5180, ...) is always allowed without hardcoding a list
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
