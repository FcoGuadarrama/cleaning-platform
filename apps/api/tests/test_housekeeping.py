from datetime import timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update

from app.core.db import get_sessionmaker
from app.core.timeutil import utcnow
from app.models import IdempotencyKey, OutboxMessage, OutboxStatus
from app.services import housekeeping, outbox
from tests.conftest import future_weekday
from tests.test_idempotency import _body, _hold


async def _prune() -> int:
    async with get_sessionmaker()() as session:
        return await housekeeping.prune(session)


async def _age(
    model: type[IdempotencyKey] | type[OutboxMessage], column: str, ago: timedelta, *ids: int
) -> None:
    async with get_sessionmaker()() as session, session.begin():
        await session.execute(update(model).where(model.id.in_(ids)).values({column: utcnow() - ago}))


async def _ids(model: type[IdempotencyKey] | type[OutboxMessage]) -> list[int]:
    async with get_sessionmaker()() as session:
        return list(await session.scalars(select(model.id).order_by(model.id)))


async def test_idempotency_keys_past_the_retry_window_are_deleted(
    client: AsyncClient, customer, world
) -> None:
    for key, hour in (("old", 9), ("recent", 14)):
        r = await _hold(
            client, customer, await _body(client, customer, world, future_weekday(hour=hour)), key
        )
        assert r.status_code == 201, r.text
    old, recent = await _ids(IdempotencyKey)
    await _age(IdempotencyKey, "created_at", timedelta(hours=25), old)
    assert await _prune() == 1
    assert await _ids(IdempotencyKey) == [recent]


async def test_only_delivered_outbox_messages_past_retention_are_deleted() -> None:
    async with get_sessionmaker()() as session, session.begin():
        for subject in range(1, 5):
            outbox.publish(session, "test.event", subject, n=subject)
    old_sent, recent_sent, old_dead, old_pending = await _ids(OutboxMessage)
    async with get_sessionmaker()() as session, session.begin():
        await session.execute(
            update(OutboxMessage)
            .where(OutboxMessage.id.in_([old_sent, recent_sent]))
            .values(status=OutboxStatus.sent, sent_at=utcnow())
        )
        await session.execute(
            update(OutboxMessage).where(OutboxMessage.id == old_dead).values(status=OutboxStatus.dead)
        )
    await _age(OutboxMessage, "sent_at", timedelta(days=8), old_sent)
    await _age(OutboxMessage, "created_at", timedelta(days=30), old_dead, old_pending)
    assert await _prune() == 1
    assert await _ids(OutboxMessage) == [recent_sent, old_dead, old_pending]


async def test_prune_deletes_in_batches(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(housekeeping, "BATCH", 2)
    async with get_sessionmaker()() as session, session.begin():
        for subject in range(1, 6):
            outbox.publish(session, "test.event", subject, n=subject)
        await session.flush()
        await session.execute(update(OutboxMessage).values(status=OutboxStatus.sent, sent_at=utcnow()))
    await _age(OutboxMessage, "sent_at", timedelta(days=8), *await _ids(OutboxMessage))
    assert await _prune() == 5
    assert await _ids(OutboxMessage) == []
