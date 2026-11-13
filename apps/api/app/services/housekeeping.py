"""Deletes rows whose purpose has passed: idempotency keys past any client's retry window and delivered
outbox messages past the retention period. Dead outbox messages are kept for inspection."""

from datetime import timedelta

from sqlalchemy import ColumnElement, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.timeutil import utcnow
from app.models import IdempotencyKey, OutboxMessage, OutboxStatus

BATCH = 500


async def prune(session: AsyncSession) -> int:
    """Returns how many rows were deleted."""
    settings, now = get_settings(), utcnow()
    keys_before = now - timedelta(hours=settings.idempotency_key_ttl_hours)
    sent_before = now - timedelta(days=settings.outbox_retention_days)
    return await _delete_in_batches(
        session, IdempotencyKey, IdempotencyKey.created_at < keys_before
    ) + await _delete_in_batches(
        session,
        OutboxMessage,
        (OutboxMessage.status == OutboxStatus.sent) & (OutboxMessage.sent_at < sent_before),
    )


async def _delete_in_batches[M: (IdempotencyKey, OutboxMessage)](
    session: AsyncSession, model: type[M], condition: ColumnElement[bool]
) -> int:
    """Short transactions deleting by primary key: no long range lock blocks the writers of the table."""
    deleted = 0
    while True:
        async with session.begin():
            ids = list(
                await session.scalars(select(model.id).where(condition).order_by(model.id).limit(BATCH))
            )
            if ids:
                await session.execute(delete(model).where(model.id.in_(ids), condition))
        deleted += len(ids)
        if len(ids) < BATCH:
            return deleted
