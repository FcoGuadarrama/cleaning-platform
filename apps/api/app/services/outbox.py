"""Transactional outbox: events for the outside world are written in the same transaction as the change that
caused them, so a rolled-back change never notifies and a crash never loses a notification.

Delivery is at least once and unordered: a message whose claim lease lapses (the process died mid-delivery)
is delivered again, and retries overtake newer messages. Receivers dedupe on `key` and load current state from
the ids in the payload. The channel is the open product decision (docs/PRODUCT.md); until it is made the `log`
channel only logs the key and ids."""

import asyncio
import logging
from datetime import date, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import insert_unless_duplicate
from app.core.timeutil import utcnow
from app.models import OutboxMessage, OutboxStatus

logger = logging.getLogger(__name__)

BATCH = 50
DELIVERY_TIMEOUT = timedelta(seconds=30)
# Longer than any delivery can take (DELIVERY_TIMEOUT), so a live claim is never delivered twice.
LEASE = timedelta(minutes=5)
MAX_ATTEMPTS = 8
MAX_BACKOFF = timedelta(hours=1)


def publish(session: AsyncSession, topic: str, subject_id: int, /, **ids: int) -> None:
    """Queues `topic` about `subject_id` in the caller's transaction. One message per topic and subject: the
    unique key turns a second publish of the same event into an integrity error, as for any duplicate."""
    session.add(OutboxMessage(key=f"{topic}:{subject_id}", topic=topic, payload=ids))


async def publish_once(
    session: AsyncSession, topic: str, subject_id: int, /, *, day: date | None = None, **ids: int
) -> bool:
    """For a job that may run many times: False when the event (for `day`, if given) was already queued."""
    key = f"{topic}:{subject_id}" + (f":{day.isoformat()}" if day else "")
    return await insert_unless_duplicate(session, OutboxMessage(key=key, topic=topic, payload=ids))


async def dispatch(session: AsyncSession) -> int:
    """Delivers due messages; returns how many were sent. Concurrent dispatchers claim disjoint rows."""
    sent = 0
    for message in await _claim(session):
        try:
            async with asyncio.timeout(DELIVERY_TIMEOUT.total_seconds()):
                await _deliver(message)
        except Exception as exc:
            await _record_failure(session, message, exc)
        else:
            await _record_sent(session, message)
            sent += 1
    return sent


async def _claim(session: AsyncSession) -> list[OutboxMessage]:
    """Leases due messages by pushing `available_at` past the delivery window, then commits, so nothing is
    locked while the network is in use. Candidates come from a plain read and are locked by primary key with
    SKIP LOCKED, as in scheduling.expire_holds."""
    async with session.begin():
        now = utcnow()
        due = (OutboxMessage.status == OutboxStatus.pending, OutboxMessage.available_at <= now)
        # More candidates than one batch, so concurrent dispatchers skip past each other's rows.
        oldest = select(OutboxMessage.id).where(*due).order_by(OutboxMessage.id).limit(BATCH * 4)
        ids = list(await session.scalars(oldest))
        claimed = list(
            await session.scalars(
                select(OutboxMessage)
                .where(OutboxMessage.id.in_(ids), *due)
                .order_by(OutboxMessage.id)
                .limit(BATCH)
                .with_for_update(skip_locked=True)
            )
        )
        for message in claimed:
            message.attempts += 1
            message.available_at = now + LEASE
    return claimed


async def _deliver(message: OutboxMessage) -> None:
    await _CHANNELS[get_settings().notification_channel](message)


async def _log_channel(message: OutboxMessage) -> None:
    logger.info("outbox %s %s", message.key, message.payload)


_CHANNELS = {"log": _log_channel}


async def _record_sent(session: AsyncSession, message: OutboxMessage) -> None:
    async with session.begin():
        await session.execute(
            update(OutboxMessage)
            .where(OutboxMessage.id == message.id)
            .values(status=OutboxStatus.sent, sent_at=utcnow(), last_error=None)
        )


async def _record_failure(session: AsyncSession, message: OutboxMessage, exc: Exception) -> None:
    """Backs off exponentially; after MAX_ATTEMPTS the message is dead and stays for inspection. Only the
    claim that failed may record it: if the lease lapsed and another dispatcher took over, it owns the row."""
    dead = message.attempts >= MAX_ATTEMPTS
    backoff = min(timedelta(seconds=30 * 2 ** (message.attempts - 1)), MAX_BACKOFF)
    async with session.begin():
        await session.execute(
            update(OutboxMessage)
            .where(
                OutboxMessage.id == message.id,
                OutboxMessage.status == OutboxStatus.pending,
                OutboxMessage.attempts == message.attempts,
            )
            .values(
                status=OutboxStatus.dead if dead else OutboxStatus.pending,
                available_at=utcnow() + backoff,
                last_error=f"{type(exc).__name__}: {exc}"[:1000],
            )
        )
    if dead:
        logger.error("outbox %s is dead after %d attempts", message.key, message.attempts, exc_info=exc)
    else:
        logger.warning("outbox %s attempt %d failed", message.key, message.attempts, exc_info=exc)
