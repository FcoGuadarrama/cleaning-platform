import asyncio
from datetime import timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update

from app.core.db import get_sessionmaker
from app.core.timeutil import utcnow
from app.models import OutboxMessage
from app.payments import sandbox
from app.services import outbox
from tests.conftest import future_weekday, hold, paid_booking
from tests.test_attendance_earnings import GPS
from tests.test_attendance_replay import _at


async def _messages() -> list[OutboxMessage]:
    async with get_sessionmaker()() as session:
        return list(await session.scalars(select(OutboxMessage).order_by(OutboxMessage.id)))


async def _queue(*subjects: int) -> None:
    async with get_sessionmaker()() as session, session.begin():
        for subject in subjects:
            outbox.publish(session, "test.event", subject, n=subject)


async def _dispatch() -> int:
    async with get_sessionmaker()() as session:
        return await outbox.dispatch(session)


async def _make_due() -> None:
    async with get_sessionmaker()() as session, session.begin():
        await session.execute(update(OutboxMessage).values(available_at=utcnow() - timedelta(seconds=1)))


async def test_events_are_published_with_their_change(client: AsyncClient, admin, customer, world) -> None:
    bid, staff = await paid_booking(client, customer, world), world["staff"]
    failed = {"capture_status": "unavailable", "occurred_at": _at(5)}
    await client.post(f"/bookings/{bid}/check-in", headers=staff, json=failed)
    attendance_id = (await client.get("/admin/attendance-exceptions", headers=admin)).json()[0][
        "attendance_id"
    ]
    other = (await hold(client, customer, world, future_weekday(hour=15))).json()
    payment = (await client.post(f"/bookings/{other['id']}/checkout", headers=customer)).json()
    await client.post(
        f"/payments/{payment['id']}/sandbox-outcome", headers=customer, json={"outcome": "failed"}
    )
    await client.post(
        f"/admin/bookings/{other['id']}/cancel", headers=admin, json={"reason": "Cliente lo pidió"}
    )

    assert [(m.key, m.payload, m.status) for m in await _messages()] == [
        (f"booking.confirmed:{bid}", {"booking_id": bid, "payment_id": 1}, "pending"),
        (
            f"attendance.exception_opened:{attendance_id}",
            {"booking_id": bid, "attendance_id": attendance_id},
            "pending",
        ),
        (f"payment.failed:{payment['id']}", {"payment_id": payment["id"]}, "pending"),
        (f"booking.cancelled:{other['id']}", {"booking_id": other["id"]}, "pending"),
    ]


async def test_rolled_back_change_publishes_nothing(
    client: AsyncClient, customer, world, monkeypatch: pytest.MonkeyPatch
) -> None:
    booking = (await hold(client, customer, world, future_weekday())).json()
    payment = (await client.post(f"/bookings/{booking['id']}/checkout", headers=customer)).json()
    body, sig = sandbox.build_event(payment["provider_ref"], "succeeded")
    publish = outbox.publish

    def publish_then_fail(*args: object, **ids: int) -> None:
        publish(*args, **ids)  # type: ignore[arg-type]
        raise RuntimeError("crash after publishing")

    with monkeypatch.context() as patched, pytest.raises(RuntimeError):
        patched.setattr(outbox, "publish", publish_then_fail)
        await client.post("/payments/webhooks/sandbox", content=body, headers={"x-sandbox-signature": sig})
    assert await _messages() == []
    assert (await client.get(f"/bookings/{booking['id']}", headers=customer)).json()["status"] == "held"


async def test_dispatch_delivers_each_due_message_once() -> None:
    await _queue(1, 2)
    assert await _dispatch() == 2
    assert await _dispatch() == 0
    assert [(m.status, m.attempts) for m in await _messages()] == [("sent", 1), ("sent", 1)]


async def test_failed_delivery_backs_off_then_dies(monkeypatch: pytest.MonkeyPatch) -> None:
    async def unreachable(_: OutboxMessage) -> None:
        raise ConnectionError("channel down")

    monkeypatch.setattr(outbox, "_deliver", unreachable)
    await _queue(1)
    assert await _dispatch() == 0
    [message] = await _messages()
    assert (message.status, message.attempts, message.last_error) == (
        "pending",
        1,
        "ConnectionError: channel down",
    )
    assert message.available_at > utcnow()
    await _dispatch()
    assert (await _messages())[0].attempts == 1, "not retried before its backoff"

    for _ in range(outbox.MAX_ATTEMPTS - 1):
        await _make_due()
        await _dispatch()
    assert [(m.status, m.attempts) for m in await _messages()] == [("dead", outbox.MAX_ATTEMPTS)]
    await _make_due()
    await _dispatch()
    assert (await _messages())[0].attempts == outbox.MAX_ATTEMPTS, "a dead message is never retried"


async def test_concurrent_dispatchers_claim_disjoint_messages(monkeypatch: pytest.MonkeyPatch) -> None:
    delivered: list[str] = []

    async def slow(message: OutboxMessage) -> None:
        await asyncio.sleep(0.05)
        delivered.append(message.key)

    monkeypatch.setattr(outbox, "_deliver", slow)
    monkeypatch.setattr(outbox, "BATCH", 3)
    await _queue(*range(1, 10))
    for _ in range(5):
        await asyncio.gather(*(_dispatch() for _ in range(3)))
    assert sorted(delivered) == sorted(f"test.event:{i}" for i in range(1, 10))


async def test_lapsed_lease_is_delivered_again_and_the_stale_claim_cannot_undo_it() -> None:
    """A dispatcher that died mid-delivery: its lease lapses and another dispatcher delivers the message."""
    await _queue(1)
    async with get_sessionmaker()() as session:
        [stale] = await outbox._claim(session)
    await _make_due()
    assert await _dispatch() == 1
    async with get_sessionmaker()() as session:
        await outbox._record_failure(session, stale, ConnectionError("late"))
    assert [(m.status, m.attempts) for m in await _messages()] == [("sent", 2)]


async def test_check_in_replay_publishes_one_exception_event(client: AsyncClient, customer, world) -> None:
    bid, staff = await paid_booking(client, customer, world), world["staff"]
    failed = {"capture_status": "unavailable", "occurred_at": _at(0)}
    for _ in range(2):
        assert (await client.post(f"/bookings/{bid}/check-in", headers=staff, json=failed)).status_code == 201
    await client.post(f"/bookings/{bid}/check-out", headers=staff, json={**GPS, "occurred_at": _at(0)})
    topics = [m.topic for m in await _messages()]
    assert topics == ["booking.confirmed", "attendance.exception_opened"]
