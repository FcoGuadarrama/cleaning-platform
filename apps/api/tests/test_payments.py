from datetime import timedelta

from httpx import AsyncClient
from sqlalchemy import update

from app.core.db import get_sessionmaker
from app.core.timeutil import utcnow
from app.models import Booking
from app.payments import sandbox
from tests.conftest import future_weekday, hold


async def _checkout(client, customer, world):
    booking = (await hold(client, customer, world, future_weekday())).json()
    payment = (await client.post(f"/bookings/{booking['id']}/checkout", headers=customer)).json()
    return booking, payment


async def test_webhook_replay_is_idempotent(client: AsyncClient, customer, world) -> None:
    booking, payment = await _checkout(client, customer, world)
    body, sig = sandbox.build_event(payment["provider_ref"], "succeeded")
    headers = {"x-sandbox-signature": sig, "content-type": "application/json"}
    first = await client.post("/payments/webhooks/sandbox", content=body, headers=headers)
    second = await client.post("/payments/webhooks/sandbox", content=body, headers=headers)
    assert first.json() == {"received": True, "duplicate": False}
    assert second.json() == {"received": True, "duplicate": True}
    assert (await client.get(f"/bookings/{booking['id']}", headers=customer)).json()["status"] == "confirmed"


async def test_webhook_rejects_bad_signature(client: AsyncClient, customer, world) -> None:
    _, payment = await _checkout(client, customer, world)
    body, _ = sandbox.build_event(payment["provider_ref"], "succeeded")
    r = await client.post(
        "/payments/webhooks/sandbox", content=body, headers={"x-sandbox-signature": "0" * 64}
    )
    assert r.status_code == 400 and r.json()["code"] == "invalid_signature"


async def test_payment_after_hold_expiry_flags_refund(client: AsyncClient, customer, world) -> None:
    booking, payment = await _checkout(client, customer, world)
    async with get_sessionmaker()() as s, s.begin():
        await s.execute(
            update(Booking)
            .where(Booking.id == booking["id"])
            .values(hold_expires_at=utcnow() - timedelta(seconds=1))
        )
    r = await client.post(f"/payments/{payment['id']}/sandbox-outcome", headers=customer, json={})
    assert r.json()["status"] == "succeeded"
    assert (await client.get(f"/bookings/{booking['id']}", headers=customer)).json()["status"] == "held"
    # Slot is free again for others: the expired hold no longer blocks.
    assert (await hold(client, customer, world, future_weekday())).status_code == 201


async def test_failed_payment_keeps_booking_unconfirmed(client: AsyncClient, customer, world) -> None:
    booking, payment = await _checkout(client, customer, world)
    r = await client.post(
        f"/payments/{payment['id']}/sandbox-outcome", headers=customer, json={"outcome": "failed"}
    )
    assert r.json()["status"] == "failed"
    assert (await client.get(f"/bookings/{booking['id']}", headers=customer)).json()["status"] == "held"
