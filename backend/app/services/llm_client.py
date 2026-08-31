"""
Clean LLM service abstraction.

Design intent: the AI Laboratory Assistant must work perfectly in a demo with
ZERO external API keys (hackathon judges won't have your credentials), so
every feature has a deterministic, template-based implementation by default.

If LLM_PROVIDER_API_KEY is set, `generate()` calls a real LLM to produce more
natural phrasing — but the underlying FACTS it's given (calculated values,
rule criteria, PASS/FAIL) always come from the ComplianceEngine, never from
the model itself. The LLM only rephrases; it never decides compliance.
"""
import json
import urllib.request
import urllib.error
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings


class LLMUnavailable(Exception):
    pass


def _resolve_api_key(db: Optional[Session]) -> str:
    """DB-stored key (set via Settings UI) takes priority over .env."""
    if db is not None:
        from app.services.app_settings import get_effective
        try:
            key = get_effective(db, "LLM_PROVIDER_API_KEY")
            if key:
                return key
        except Exception:
            pass
    return settings.LLM_PROVIDER_API_KEY


def generate(system_prompt: str, user_prompt: str, max_tokens: int = 300, db: Optional[Session] = None) -> str:
    """
    Calls Anthropic's Messages API if a key is configured (DB setting first,
    then .env fallback). Raises LLMUnavailable if no key is set or the call
    fails — callers should catch this and fall back to their deterministic
    template.
    """
    api_key = _resolve_api_key(db)
    if not api_key:
        raise LLMUnavailable("No LLM_PROVIDER_API_KEY configured")

    body = json.dumps({
        "model": "claude-sonnet-5",
        "max_tokens": max_tokens,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_prompt}],
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        text_blocks = [b["text"] for b in data.get("content", []) if b.get("type") == "text"]
        if not text_blocks:
            raise LLMUnavailable("Empty LLM response")
        return "\n".join(text_blocks).strip()
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise LLMUnavailable(f"HTTP {e.code}: {detail}")
    except (urllib.error.URLError, KeyError, json.JSONDecodeError) as e:
        raise LLMUnavailable(str(e))
