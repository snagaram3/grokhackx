"""Parse ADK tool responses into existing receipts. Never invent posts."""

from __future__ import annotations

import json
from typing import Any


def unwrap_tool_response(response: Any) -> Any:
    if isinstance(response, dict) and "result" in response and len(response) <= 2:
        return response.get("result")
    return response


def posts_from_response(response: Any) -> list[dict[str, Any]]:
    data = unwrap_tool_response(response)
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except Exception:
            return []
    if isinstance(data, dict):
        rows = data.get("posts")
        if isinstance(rows, list):
            return [p for p in rows if isinstance(p, dict)]
    if isinstance(data, list):
        return [p for p in data if isinstance(p, dict)]
    return []


def function_responses_from_event(event: Any) -> list[tuple[str, Any]]:
    out: list[tuple[str, Any]] = []
    getter = getattr(event, "get_function_responses", None)
    if callable(getter):
        for fr in getter() or []:
            out.append((str(getattr(fr, "name", "") or ""), getattr(fr, "response", None)))
    content = getattr(event, "content", None)
    for part in getattr(content, "parts", None) or []:
        fr = getattr(part, "function_response", None)
        if fr is None:
            continue
        out.append((str(getattr(fr, "name", "") or ""), getattr(fr, "response", None)))
    return out
