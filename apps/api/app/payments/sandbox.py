"""Sandbox payment provider. Never moves real money; the only provider enabled until decision #3."""

import json
import secrets
from typing import Any

from app.core.config import get_settings
from app.core.security import sign

PROVIDER = "sandbox"


def new_reference() -> str:
    return f"sbx_{secrets.token_hex(12)}"


def build_event(provider_ref: str, outcome: str) -> tuple[bytes, str]:
    """Builds a signed event exactly as the sandbox 'provider' would deliver it."""
    event: dict[str, Any] = {
        "id": f"evt_{secrets.token_hex(12)}",
        "type": f"payment.{outcome}",
        "data": {"reference": provider_ref},
    }
    body = json.dumps(event, sort_keys=True).encode()
    return body, sign(body, get_settings().sandbox_webhook_secret)
