import secrets
import time

import bcrypt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.api.utils.common import commonUtils

INACTIVITY_TIMEOUT_SECONDS = 60 * 60  # 1 hour

bearer_scheme = HTTPBearer(auto_error=False)


class AuthService:
    """Single hardcoded operator login. Tokens are opaque, random, and held
    in memory only — same pattern as ChatService's session store, so a
    server restart simply logs everyone out rather than needing a DB.

    Each token tracks its own last-seen time; require_auth refreshes it on
    every authenticated request and rejects (and drops) tokens that have
    gone unused for longer than INACTIVITY_TIMEOUT_SECONDS."""

    def __init__(self, username, password_hash):
        self.username = username
        self.password_hash = password_hash.encode() if password_hash else b""
        self._tokens = {}  # token -> last_active_at (epoch seconds)

    def login(self, username, password):
        commonUtils().wake_up_llm()
        if not self.username or not self.password_hash:
            raise HTTPException(status_code=500, detail="Auth is not configured on the server.")
        if username != self.username or not bcrypt.checkpw(password.encode(), self.password_hash):
            raise HTTPException(status_code=401, detail="Invalid username or password.")
        token = secrets.token_urlsafe(32)
        self._tokens[token] = time.time()
        return token

    def logout(self, token):
        self._tokens.pop(token, None)

    def require_auth(self, credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
        if not credentials:
            raise HTTPException(status_code=401, detail="Missing bearer token.")
        token = credentials.credentials

        last_active = self._tokens.get(token)
        if last_active is None:
            raise HTTPException(status_code=401, detail="Invalid or expired token.")

        if time.time() - last_active > INACTIVITY_TIMEOUT_SECONDS:
            self._tokens.pop(token, None)
            raise HTTPException(status_code=401, detail="Session expired due to inactivity.")

        self._tokens[token] = time.time()
        return token
