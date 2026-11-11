"""Owner decision 2026-11-11: card and SPEI only; an agent confirms each transfer; the slot holds 24 h."""

from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update

from app.core.config import get_settings
from app.core.db import get_sessionmaker
from app.core.timeutil import utcnow
from app.models import Booking, OutboxMessage, Payment, SubscriptionCycle
from tests.conftest import future_weekday, hold
from tests.test_subscription_checkout import choice, contract
from tests.test_subscription_plans import create_plan

SPEI = {"method": "spei"}


async def _spei_booking(client: AsyncClient, customer, world) -> tuple[dict, dict]:
    booking = (await hold(client, customer, world, future_weekday())).json()
    r = await client.post(f"/bookings/{booking['id']}/checkout", headers=customer, json=SPEI)
    assert r.status_code == 201, r.text
    return booking, r.json()


async def _booking(client: AsyncClient, customer, booking_id: int) -> dict:
    return (await client.get(f"/bookings/{booking_id}", headers=customer)).json()


def _hours_left(iso: str) -> float:
    return (datetime.fromisoformat(iso) - utcnow()).total_seconds() / 3600


async def test_spei_checkout_holds_the_slot_a_day_and_gives_transfer_instructions(
    client: AsyncClient, customer, world
) -> None:
    booking, payment = await _spei_booking(client, customer, world)
    assert payment["method"] == "spei" and payment["status"] == "pending"
    assert payment["transfer"] == {
        "clabe": "000000000000000000",
        "bank": "Banco de prueba",
        "beneficiary": "Cuenta de prueba",
        "reference": payment["provider_ref"],
        "amount_minor": payment["amount_minor"],
        "currency": "MXN",
    }
    assert 23.9 < _hours_left((await _booking(client, customer, booking["id"]))["hold_expires_at"]) <= 24
    again = await client.post(f"/bookings/{booking['id']}/checkout", headers=customer, json=SPEI)
    assert again.json()["id"] == payment["id"]

    card = await client.post(f"/bookings/{booking['id']}/checkout", headers=customer)
    assert card.status_code == 409 and card.json()["code"] == "payment_in_progress"
    simulated = await client.post(f"/payments/{payment['id']}/sandbox-outcome", headers=customer, json={})
    assert simulated.status_code == 409 and simulated.json()["code"] == "not_a_card_payment"


async def test_agent_confirms_the_transfer_and_the_visit_is_booked(
    client: AsyncClient, admin, customer, world
) -> None:
    booking, payment = await _spei_booking(client, customer, world)
    [listed] = (await client.get("/admin/transfers", headers=admin)).json()
    assert (listed["id"], listed["customer_id"], listed["subscription_id"]) == (payment["id"], 2, None)
    assert listed["pay_by"] is not None and listed["transfer"]["reference"] == payment["provider_ref"]
    assert (await client.get("/admin/transfers", headers=customer)).status_code == 403

    url = f"/admin/payments/{payment['id']}/confirm-transfer"
    confirmed = await client.post(url, headers=admin, json={"note": "Depósito visto en el estado de cuenta"})
    assert confirmed.json()["status"] == "succeeded"
    assert (await _booking(client, customer, booking["id"]))["status"] == "confirmed"
    again = await client.post(url, headers=admin, json={})
    assert again.status_code == 409 and again.json()["code"] == "transfer_reviewed"
    assert (await client.get("/admin/transfers", headers=admin)).json() == []
    async with get_sessionmaker()() as session:
        keys = list(await session.scalars(select(OutboxMessage.key)))
    assert f"booking.confirmed:{booking['id']}" in keys


async def test_rejected_transfer_keeps_the_hold_for_another_try(
    client: AsyncClient, admin, customer, world
) -> None:
    booking, payment = await _spei_booking(client, customer, world)
    r = await client.post(
        f"/admin/payments/{payment['id']}/reject-transfer",
        headers=admin,
        json={"note": "No llegó el depósito"},
    )
    assert r.json()["status"] == "failed"
    assert (await _booking(client, customer, booking["id"]))["status"] == "held"
    retry = await client.post(f"/bookings/{booking['id']}/checkout", headers=customer, json=SPEI)
    assert retry.status_code == 201 and retry.json()["provider_ref"] != payment["provider_ref"]


async def test_transfer_confirmed_after_the_hold_lapsed_is_flagged_for_refund(
    client: AsyncClient, admin, customer, world
) -> None:
    booking, payment = await _spei_booking(client, customer, world)
    async with get_sessionmaker()() as session, session.begin():
        lapsed = utcnow() - timedelta(minutes=1)
        await session.execute(
            update(Booking).where(Booking.id == booking["id"]).values(hold_expires_at=lapsed)
        )
    assert (await _booking(client, customer, booking["id"]))["status"] == "expired"
    [listed] = (await client.get("/admin/transfers", headers=admin)).json()
    assert listed["pay_by"] is None
    await client.post(f"/admin/payments/{payment['id']}/confirm-transfer", headers=admin, json={})
    async with get_sessionmaker()() as session:
        stored = await session.get_one(Payment, payment["id"])
    assert (stored.status, stored.needs_refund) == ("succeeded", True)


async def test_spei_for_a_plan_holds_every_visit_a_day_and_renews_by_spei(
    client: AsyncClient, admin, customer, world
) -> None:
    plan = await create_plan(client, admin, days_per_week=2)
    subscription = await contract(client, customer, await choice(client, customer, world, plan))
    r = await client.post(f"/subscriptions/{subscription['id']}/checkout", headers=customer, json=SPEI)
    assert r.status_code == 201 and r.json()["transfer"] is not None
    async with get_sessionmaker()() as session:
        expiries = set(
            await session.scalars(
                select(Booking.hold_expires_at).where(Booking.subscription_cycle_id.is_not(None))
            )
        )
        cycle_expiry = await session.scalar(select(SubscriptionCycle.hold_expires_at))
    assert expiries == {cycle_expiry} and 23.9 < _hours_left(cycle_expiry.isoformat()) <= 24

    await client.post(f"/admin/payments/{r.json()['id']}/confirm-transfer", headers=admin, json={})
    mine = (await client.get(f"/subscriptions/{subscription['id']}", headers=customer)).json()
    assert (mine["status"], mine["payment_method"]) == ("active", "spei")


async def test_spei_is_unavailable_until_the_account_is_configured(
    client: AsyncClient, customer, world, monkeypatch: pytest.MonkeyPatch
) -> None:
    booking = (await hold(client, customer, world, future_weekday())).json()
    monkeypatch.setenv("SPEI_CLABE", "")
    get_settings.cache_clear()
    try:
        r = await client.post(f"/bookings/{booking['id']}/checkout", headers=customer, json=SPEI)
    finally:
        get_settings.cache_clear()
    assert r.status_code == 409 and r.json()["code"] == "spei_unavailable"
