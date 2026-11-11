"""Owner decisions 2026-11-11: renewal notice on the last visit day, charge on the next business day, retries
every business day until the day before the next cycle's first visit, cancellation at the end of the paid
cycle. A one-day (Tuesday) plan starting on Tuesday S: last visit S+21, charge Wednesday S+22, next cycle
S+28."""

import asyncio
from datetime import date, datetime, time, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update

from app.core.config import get_settings
from app.core.db import get_sessionmaker
from app.core.timeutil import utcnow
from app.models import Booking, OutboxMessage, Payment, SubscriptionCycle
from app.services import renewals
from tests.conftest import hold, register
from tests.test_subscription_checkout import choice, contract, pay
from tests.test_subscription_plans import create_plan


async def _active(client: AsyncClient, admin, customer, world, *, spei: bool = False) -> tuple[dict, date]:
    plan = await create_plan(client, admin, days_per_week=1)
    body = await choice(client, customer, world, plan)
    subscription = await contract(client, customer, body)
    if spei:
        r = await client.post(
            f"/subscriptions/{subscription['id']}/checkout", headers=customer, json={"method": "spei"}
        )
        await client.post(f"/admin/payments/{r.json()['id']}/confirm-transfer", headers=admin, json={})
    else:
        await pay(client, customer, subscription["id"])
    return subscription, date.fromisoformat(body["starts_on"])


async def _run(today: date) -> int:
    async with get_sessionmaker()() as session:
        return await renewals.run(session, today)


async def _mine(client: AsyncClient, customer, subscription: dict) -> Any:
    return (await client.get(f"/subscriptions/{subscription['id']}", headers=customer)).json()


async def _outbox() -> list[str]:
    async with get_sessionmaker()() as session:
        return list(await session.scalars(select(OutboxMessage.key).order_by(OutboxMessage.id)))


async def _payments(cycle_id: int) -> list[tuple[str, str]]:
    async with get_sessionmaker()() as session:
        rows = await session.scalars(
            select(Payment).where(Payment.subscription_cycle_id == cycle_id).order_by(Payment.id)
        )
        return [(p.method, p.status) for p in rows]


def _set_outcome(monkeypatch: pytest.MonkeyPatch, outcome: str) -> None:
    monkeypatch.setenv("SANDBOX_RENEWAL_OUTCOME", outcome)
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def _fresh_settings() -> Any:
    yield
    get_settings.cache_clear()


def _at(day: date, hour: int = 10) -> datetime:
    return datetime.combine(day, time(hour), get_settings().business_tz)


async def test_notice_on_the_last_visit_then_the_card_renews_the_next_business_day(
    client: AsyncClient, admin, customer, world
) -> None:
    subscription, s = await _active(client, admin, customer, world)
    first_cycle = (await _mine(client, customer, subscription))["cycles"][0]["id"]
    mine = await _mine(client, customer, subscription)
    assert (mine["renewal_notice_on"], mine["next_charge_on"]) == (
        (s + timedelta(days=21)).isoformat(),
        (s + timedelta(days=22)).isoformat(),
    )

    assert await _run(s + timedelta(days=20)) == 0
    assert await _run(s + timedelta(days=21)) == 1
    assert await _run(s + timedelta(days=21)) == 0, "the notice goes out once"
    assert f"subscription.renewal_notice:{first_cycle}" in await _outbox()

    assert await _run(s + timedelta(days=22)) == 1
    mine = await _mine(client, customer, subscription)
    second = mine["cycles"][1]
    assert (second["sequence"], second["status"], second["starts_on"]) == (
        2,
        "confirmed",
        (s + timedelta(days=28)).isoformat(),
    )
    assert [v["status"] for v in second["visits"]] == ["confirmed"] * 4
    assert mine["next_charge_on"] == (s + timedelta(days=50)).isoformat()
    assert f"subscription.cycle_confirmed:{second['id']}" in await _outbox()
    assert await _run(s + timedelta(days=22)) == 0


async def test_a_declined_card_is_retried_each_business_day_and_can_be_paid_by_hand(
    client: AsyncClient, admin, customer, world, monkeypatch: pytest.MonkeyPatch
) -> None:
    subscription, s = await _active(client, admin, customer, world)
    _set_outcome(monkeypatch, "failed")
    charge_day = s + timedelta(days=22)
    await _run(charge_day)
    second = (await _mine(client, customer, subscription))["cycles"][1]
    assert second["status"] == "held"
    assert await _payments(second["id"]) == [("card", "failed")]
    await _run(charge_day)
    assert len(await _payments(second["id"])) == 1, "one attempt per business day"
    await _run(charge_day + timedelta(days=1))
    await _run(charge_day + timedelta(days=3))  # Saturday
    assert await _payments(second["id"]) == [("card", "failed")] * 2

    await pay(client, customer, subscription["id"])
    mine = await _mine(client, customer, subscription)
    assert (mine["status"], mine["cycles"][1]["status"]) == ("active", "confirmed")
    assert await _run(charge_day + timedelta(days=4)) == 0


async def test_unpaid_by_the_deadline_ends_the_subscription_and_frees_the_cleaner(
    client: AsyncClient, admin, customer, world, monkeypatch: pytest.MonkeyPatch
) -> None:
    subscription, s = await _active(client, admin, customer, world)
    _set_outcome(monkeypatch, "failed")
    await _run(s + timedelta(days=22))
    second = (await _mine(client, customer, subscription))["cycles"][1]
    deadline = datetime.fromisoformat(second["hold_expires_at"])
    assert deadline == _at(s + timedelta(days=28), 0), "midnight before the next cycle's first visit"
    lapsed = utcnow() - timedelta(minutes=1)
    async with get_sessionmaker()() as session, session.begin():
        await session.execute(
            update(SubscriptionCycle)
            .where(SubscriptionCycle.id == second["id"])
            .values(hold_expires_at=lapsed)
        )
        await session.execute(
            update(Booking)
            .where(Booking.subscription_cycle_id == second["id"])
            .values(hold_expires_at=lapsed)
        )
    mine = await _mine(client, customer, subscription)
    assert (mine["status"], mine["end_reason"], mine["cycles"][1]["status"]) == ("ended", "unpaid", "expired")
    assert f"subscription.ended:{subscription['id']}" in await _outbox()
    other = await register(client, "other@test.com")
    assert (await hold(client, other, world, _at(s + timedelta(days=56)))).status_code == 201


async def test_a_spei_renewal_waits_for_the_agent_and_is_reminded_each_business_day(
    client: AsyncClient, admin, customer, world
) -> None:
    subscription, s = await _active(client, admin, customer, world, spei=True)
    charge_day = s + timedelta(days=22)
    assert await _run(charge_day) == 2, "the notice (not sent on its day) and the renewal"
    second = (await _mine(client, customer, subscription))["cycles"][1]
    assert await _payments(second["id"]) == [("spei", "pending")]
    await _run(charge_day + timedelta(days=1))
    reminders = [k for k in await _outbox() if k.startswith("subscription.renewal_transfer_due")]
    assert reminders == [
        f"subscription.renewal_transfer_due:{second['id']}:{charge_day.isoformat()}",
        f"subscription.renewal_transfer_due:{second['id']}:{(charge_day + timedelta(days=1)).isoformat()}",
    ]

    [first_try] = (await client.get("/admin/transfers", headers=admin)).json()
    await client.post(
        f"/admin/payments/{first_try['id']}/reject-transfer", headers=admin, json={"note": "No llegó"}
    )
    await _run(charge_day + timedelta(days=2))
    [second_try] = (await client.get("/admin/transfers", headers=admin)).json()
    assert second_try["provider_ref"] != first_try["provider_ref"]
    await client.post(f"/admin/payments/{second_try['id']}/confirm-transfer", headers=admin, json={})
    assert (await _mine(client, customer, subscription))["cycles"][1]["status"] == "confirmed"


async def test_cancelling_stops_the_renewal_and_ends_after_the_paid_cycle(
    client: AsyncClient, admin, customer, world
) -> None:
    subscription, s = await _active(client, admin, customer, world)
    cancelled = await client.post(f"/subscriptions/{subscription['id']}/cancel", headers=customer)
    assert cancelled.status_code == 200, cancelled.text
    mine = cancelled.json()
    assert mine["cancelled_at"] is not None and mine["status"] == "active"
    assert (mine["renews_on"], mine["next_charge_on"]) == (None, None)
    again = await client.post(f"/subscriptions/{subscription['id']}/cancel", headers=customer)
    assert again.status_code == 409 and again.json()["code"] == "subscription_not_cancellable"

    assert await _run(s + timedelta(days=22)) == 0
    assert len((await _mine(client, customer, subscription))["cycles"]) == 1
    assert await _run(s + timedelta(days=27)) == 0
    assert await _run(s + timedelta(days=28)) == 1
    mine = await _mine(client, customer, subscription)
    assert (mine["status"], mine["end_reason"]) == ("ended", "cancelled")
    other = await register(client, "other@test.com")
    assert (await hold(client, other, world, _at(s + timedelta(days=28)))).status_code == 201


async def test_cancelling_drops_a_renewal_awaiting_payment(
    client: AsyncClient, admin, customer, world, monkeypatch: pytest.MonkeyPatch
) -> None:
    subscription, s = await _active(client, admin, customer, world)
    _set_outcome(monkeypatch, "failed")
    await _run(s + timedelta(days=22))
    await client.post(f"/subscriptions/{subscription['id']}/cancel", headers=customer)
    second = (await _mine(client, customer, subscription))["cycles"][1]
    assert second["status"] == "expired" and {v["status"] for v in second["visits"]} == {"expired"}
    assert await _run(s + timedelta(days=23)) == 0


async def test_concurrent_runs_open_one_renewal(client: AsyncClient, admin, customer, world) -> None:
    subscription, s = await _active(client, admin, customer, world)
    await asyncio.gather(*(_run(s + timedelta(days=22)) for _ in range(3)))
    cycles = (await _mine(client, customer, subscription))["cycles"]
    assert [c["sequence"] for c in cycles] == [1, 2]
    assert len(await _payments(cycles[1]["id"])) == 1
