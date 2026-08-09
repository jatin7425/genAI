import sys
from pathlib import Path
from typing import Any
import requests

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

try:
    from src.config import CONFIG
except ModuleNotFoundError:  # pragma: no cover
    from src.config import CONFIG


class llmClient:
    def __init__(self) -> None:
        self.CONFIG: dict[str, Any] = CONFIG
        self.api_config: dict[str, Any] = self.CONFIG.get("API", {})

    def get_headers(self) -> dict[str, str]:
        master_key = self.api_config.get("master_key", "")
        if not isinstance(master_key, str):
            master_key = str(master_key)

        return {
            "Authorization": f"Bearer {master_key}",
            "Content-Type": "application/json",
        }

    def get_full_url(self, endpoint_key: str) -> str:
        base_url = self.api_config.get("base_url", "")
        endpoints = self.api_config.get("Endpoints", {})
        endpoint_path = ""

        if isinstance(endpoints, dict):
            endpoint_path = endpoints.get(endpoint_key, "")

        if not isinstance(base_url, str):
            base_url = str(base_url)
        if not isinstance(endpoint_path, str):
            endpoint_path = str(endpoint_path)

        return f"{base_url}{endpoint_path}"

    def call_api(self, endpoint_key: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = self.get_full_url(endpoint_key)
        headers = self.get_headers()

        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()

    def list_models(self) -> list[dict[str, Any]]:
        url = self.get_full_url("models")
        headers = self.get_headers()

        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json().get("data", [])