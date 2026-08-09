from pathlib import Path
import os
from typing import Any, cast

from dotenv import load_dotenv
import yaml

BASE_DIR = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = Path(__file__).resolve().parent / "config.yaml"
ENV_PATH = BASE_DIR / ".env"

load_dotenv(ENV_PATH)


def _resolve_env(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _resolve_env(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_resolve_env(item) for item in value]
    if isinstance(value, str):
        if value.startswith("${") and value.endswith("}"):
            key = value[2:-1]
            return os.getenv(key, "")
        return value
    return value


def load_config() -> dict[str, Any]:
    with CONFIG_PATH.open("r", encoding="utf-8") as handle:
        raw_config = yaml.safe_load(handle) or {}
    return cast(dict[str, Any], _resolve_env(raw_config))


CONFIG: dict[str, Any] = load_config()

__all__ = ["CONFIG", "load_config"]
