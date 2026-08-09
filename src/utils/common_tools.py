import ipaddress
import logging
import socket
from urllib.parse import urlparse

import requests

from src.config import CONFIG

logger = logging.getLogger(__name__)
config = CONFIG.get("flags", {})

class CommonTools:
    def __init__(self):
        self._tool_dispatch = {
            "call_api": self.call_api,
            "ask_user": self.ask_user,
        }
    
    @staticmethod
    def _tool():
        return [
            {
                "type": "function",
                "function": {
                    "name": "call_api",
                    "description": (
                        "Call an external HTTP API. Use only for endpoints you already "
                        "know the URL of (e.g. from prior tool results or the task itself) "
                        "— this does not discover new URLs on its own."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "url": {"type": "string", "description": "Full URL to call."},
                            "method": {
                                "type": "string",
                                "enum": ["GET", "POST", "PUT", "PATCH", "DELETE"],
                            },
                            "params": {
                                "type": "object",
                                "description": "Query params (GET) or JSON body (POST/PUT/PATCH).",
                            },
                        },
                        "required": ["url", "method"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "ask_user",
                    "description": (
                        "Ask the user a question and get their input. Use this when you need "
                        "clarification or additional information to complete the task."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "question": {"type": "string", "description": "The question to ask the user."},
                        },
                        "required": ["question"],
                    },

                }
            }
        ]
    
    @staticmethod
    def response_format():
        return {
            "type": "function",
            "function": {
                "name": "submit_answer",
                "description": "Submit your final answer once you have enough information. This ends the task.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "answer": {"type": "string", "description": "The direct answer to the task."},
                        "sources": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "URLs actually used to reach this answer.",
                        },
                        "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
                    },
                    "required": ["answer", "sources", "confidence"],
                },
            },
        }

    def ask_user(self, question):
        if config.get("is_terminal"):
            return input(question)
        else:
            return None

    @staticmethod
    def _is_blocked_host(url):
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            return True
        try:
            addrs = {info[4][0] for info in socket.getaddrinfo(parsed.hostname, None)}
        except socket.gaierror:
            return True
        for addr in addrs:
            ip = ipaddress.ip_address(addr)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return True
        return False

    def call_api(self, url, method, params=None, headers=None, timeout=10, **kwargs):
        method = method.upper()
        if self._is_blocked_host(url):
            return {"error": f"Invalid or blocked URL: {url}", "status_code": None}
        try:
            if method == "GET":
                response = requests.request(method, url, params=params, headers=headers, timeout=timeout, **kwargs)
            else:
                response = requests.request(method, url, json=params, headers=headers, timeout=timeout, **kwargs)
            response.raise_for_status()
            return response.json() if response.content else {}
        except requests.exceptions.RequestException as e:
            status = getattr(getattr(e, "response", None), "status_code", None)
            logger.warning("HTTP request failed: %s", e)
            return {"error": str(e), "status_code": status}
        except Exception as e:
            logger.warning("Unexpected error during API call: %s", e)
            return {"error": str(e), "status_code": None}

    def call_tool(self, name, args):
        handler = self._tool_dispatch.get(name)
        if handler is None:
            return {"error": f"unknown tool {name}"}
        try:
            return handler(**args)
        except Exception as e:
            return {"error": f"{name} failed: {e}"}