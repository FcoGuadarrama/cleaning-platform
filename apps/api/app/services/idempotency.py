"""Replay-safe creates. A client that retries a POST with the same Idempotency-Key (for example after losing
the response) gets the resource the first attempt created, instead of a second one or a 409 against its own
hold."""

import hashlib

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import insert_unless_duplicate
from app.core.errors import conflict
from app.models import IdempotencyKey, User


def _fingerprint(scope: str, request: BaseModel) -> str:
    return hashlib.sha256(f"{scope}\n{request.model_dump_json()}".encode()).hexdigest()


async def claim(
    session: AsyncSession, user: User, key: str, scope: str, request: BaseModel
) -> IdempotencyKey:
    """Call first inside the create's transaction. Returns the key row: `resource_id` is None when this
    attempt owns the key (set it before commit), or the id the earlier attempt created. A concurrent attempt
    waits on the unique index until the first commits (it then replays) or rolls back (it then claims the
    key)."""
    fingerprint = _fingerprint(scope, request)
    row = IdempotencyKey(user_id=user.id, key=key, fingerprint=fingerprint)
    if await insert_unless_duplicate(session, row):
        return row
    # A shared lock reads the committed row and, unlike FOR UPDATE, never deadlocks with other replays.
    existing = await session.scalar(
        select(IdempotencyKey)
        .where(IdempotencyKey.user_id == user.id, IdempotencyKey.key == key)
        .with_for_update(read=True)
    )
    if existing is None or existing.fingerprint != fingerprint:
        raise conflict("idempotency_key_reused", "This Idempotency-Key was used for a different request")
    return existing
