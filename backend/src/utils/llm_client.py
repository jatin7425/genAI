from concurrent.futures import ThreadPoolExecutor, as_completed
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
import requests
import base64
from typing import Any

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
        self._model_cache: list[str] | None = None

    def available_models(self) -> list[str]:
        if self._model_cache is None:
            self._model_cache = [m["id"] for m in self.list_models()]
        print("Avaulable Models", self._model_cache)
        return self._model_cache 

    def _valid_model(self, model: str) -> bool:
        return model in self.available_models()

    def get_headers(self) -> dict[str, str]:
        master_key = self.api_config.get("master_key", "")
        if not isinstance(master_key, str):
            master_key = str(master_key)

        return {
            "Authorization": f"Bearer {master_key}",
            "Content-Type": "application/json",
        }

    def get_full_url(self, endpoint_key: str) -> str | list[str]:
        base_url = self.api_config.get("base_url", "")
        endpoints = self.api_config.get("Endpoints", {})
        endpoint_path = ""

        if isinstance(endpoints, dict):
            endpoint_path = endpoints.get(endpoint_key, "")

        if not isinstance(base_url, str):
            base_url = str(base_url)
        
        # Handle list of endpoints
        if isinstance(endpoint_path, list):
            return [f"{base_url}{path}" if isinstance(path, str) else f"{base_url}{str(path)}" 
                    for path in endpoint_path]
        
        # Handle single endpoint (string)
        if not isinstance(endpoint_path, str):
            endpoint_path = str(endpoint_path)
        
        return f"{base_url}{endpoint_path}"

    def _prepare_request(self, endpoint_key: str, payload: dict[str, Any]) -> tuple[str | list[str], dict[str, Any]]:
        urls = self.get_full_url(endpoint_key)
        request_payload = dict(payload)
        model = request_payload.pop("model", None)

        # Handle both string and list URLs
        if isinstance(urls, list):
            processed_urls = []
            for url in urls:
                if endpoint_key in {"chat", "embeddings"} and model is not None:
                    separator = "&" if "?" in url else "?"
                    url = f"{url}{separator}{urlencode({'model_name': model})}"
                processed_urls.append(url)
            return processed_urls, request_payload
        else:
            if endpoint_key in {"chat", "embeddings"} and model is not None:
                separator = "&" if "?" in urls else "?"
                urls = f"{urls}{separator}{urlencode({'model_name': model})}"
            return urls, request_payload

    def call_api(self, endpoint_key: str, payload: dict[str, Any]) -> dict[str, Any]:
        urls, request_payload = self._prepare_request(endpoint_key, payload)
        headers = self.get_headers()
        
        # Normalize to list
        if isinstance(urls, str):
            urls = [urls]
        
        def make_request(url: str):
            response = requests.post(url, json=request_payload, headers=headers)
            response.raise_for_status()
            return response.json()
        
        # Try all URLs in parallel
        with ThreadPoolExecutor(max_workers=len(urls)) as executor:
            futures = {executor.submit(make_request, url): url for url in urls}
            
            errors = []
            # Return first successful response
            for future in as_completed(futures):
                try:
                    return future.result()
                except Exception as e:
                    errors.append(f"{futures[future]}: {str(e)}")
                    continue
            
            # All URLs failed
            raise Exception(f"All {len(urls)} endpoints failed:\n" + "\n".join(errors))

    def list_models(self) -> list[dict[str, Any]]:
        urls = self.get_full_url("models")
        
        # Normalize to list
        if isinstance(urls, str):
            urls = [urls]
        
        headers = self.get_headers()
        
        def fetch_url(url: str):
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            # Handle format 1: {"data": [{...}, ...]}
            if "data" in data:
                return data["data"]
            # Handle format 2: {"model_names": [...]} - convert to list of dicts
            elif "model_names" in data:
                return [{"id": name} for name in data["model_names"]]
            else:
                return []
        
        # Hit all URLs in parallel
        with ThreadPoolExecutor(max_workers=len(urls)) as executor:
            futures = {executor.submit(fetch_url, url): url for url in urls}
            
            errors = []
            # Return the first successful response
            for future in as_completed(futures):
                try:
                    return future.result()
                except Exception as e:
                    errors.append(f"{futures[future]}: {str(e)}")
                    continue
            
            # All URLs failed
            raise Exception(f"All {len(urls)} URLs failed:\n" + "\n".join(errors))

    def image_summarizer(
        self,
        image: bytes,
        mime_type: str = "image/png",
        model: str = "gemini",
    ) -> str:

        if not self._valid_model(model):
            raise ValueError(
                f"unknown model '{model}'. "
                f"available: {self.available_models()}"
            )

        DESCRIBE_PROMPT = """Describe this image so someone can find it later by text search.

            Describe only what is visibly present. If text or values are cut off, blurred, or
            too small to read, say so instead of guessing. Do not infer purpose, cause, or
            conclusions the image does not state.

            Reproduce exactly the words shown in the image for titles, labels, axis and column
            names, series names, units, and product or company names — those are the terms
            people will search for.

            LENGTH
            - Images without data (photo, diagram, logo, plain screenshot): 2-4 sentences.
            - Images carrying data (chart, graph, table, dashboard, metrics panel): up to 8
            sentences. Use the extra room for values, not for description of the styling.

            DATA IMAGES
            State the title and what is measured, then the axes or column headers with their
            units and range, then the values. Lead with the values.
        """

        image_base64 = base64.b64encode(image).decode("utf-8")

        image_url = (
            f"data:{mime_type};base64,{image_base64}"
        )

        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": DESCRIBE_PROMPT,
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_url,
                            },
                        },
                    ],
                }
            ],
        }

        response = self.call_api("chat", payload)
        if response and "choices" in response and len(response["choices"]) > 0:
            return response["choices"][0].get("message", {}).get("content", "")
        return ""

    def embed(self, texts: list[str], model: str = "embed-cloudflare") -> list[list[float]]:
        if not self._valid_model(model):
            raise ValueError(
                f"unknown model '{model}'. available: {self.available_models()}"
            )
        if not texts:
            return []
        if len(texts) > 100:
            raise ValueError(f"batch of {len(texts)} exceeds Cloudflare's limit of 100")

        payload = {"model": model, "input": texts}
        response = self.call_api("embeddings", payload)

        # sort by index — order isn't guaranteed
        data = sorted(response["data"], key=lambda d: d["index"])
        return [d["embedding"] for d in data]