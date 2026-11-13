import asyncio
from datetime import timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update

from app.core.config import get_settings
from app.core.db import get_sessionmaker
from app.core.timeutil import utcnow
from app.main import create_app
from app.models import Booking, BookingStatus, Subscription, SubscriptionCycle
from app.services.scheduling import expire_holds
from tests.conftest import future_weekday, hold
from tests.test_subscription_checkout import choice
from tests.test_subscription_plans import create_plan

# Comfortably below innodb_lock_wait_timeout (10 s): a sweep that waited on a lock would time out here.
NO_WAIT = 3


async def _lapse(*rows: tuple[type[Booking] | type[SubscriptionCycle], int]) -> None:
    async with get_sessionmaker()() as session, session.begin():
        for model, row_id in rows:
            lapsed = utcnow() - timedelta(minutes=1)
            await session.execute(update(model).where(model.id == row_id).values(hold_expires_at=lapsed))


async def _status(model: type[Booking] | type[SubscriptionCycle] | type[Subscription], row_id: int) -> str:
    async with get_sessionmaker()() as session:
        return str((await session.get_one(model, row_id)).status)


async def _sweep() -> int:
    async with get_sessionmaker()() as session:
        return await asyncio.wait_for(expire_holds(session), NO_WAIT)


async def test_read_skips_a_lapsed_hold_another_transaction_holds(
    client: AsyncClient, customer, world
) -> None:
    """A payment confirming the hold has it locked: the read neither waits for it nor expires it."""
    booking = (await hold(client, customer, world, future_weekday())).json()
    await _lapse((Booking, booking["id"]))
    async with get_sessionmaker()() as payment, payment.begin():
        await payment.execute(select(Booking).where(Booking.id == booking["id"]).with_for_update())
        listed = await asyncio.wait_for(client.get("/bookings", headers=customer), NO_WAIT)
        assert [b["status"] for b in listed.json()] == ["held"]
    listed = await client.get("/bookings", headers=customer)
    assert [b["status"] for b in listed.json()] == ["expired"]


async def test_visits_wait_for_the_cycle_being_confirmed(client: AsyncClient, admin, customer, world) -> None:
    plan = await create_plan(client, admin, days_per_week=2)
    body = await choice(client, customer, world, plan)
    subscription = (await client.post("/subscriptions", headers=customer, json=body)).json()
    async with get_sessionmaker()() as session:
        cycle = await session.scalar(
            select(SubscriptionCycle.id).where(SubscriptionCycle.subscription_id == subscription["id"])
        )
        visits = list(await session.scalars(select(Booking.id).where(Booking.subscription_cycle_id == cycle)))
    assert cycle is not None and len(visits) >= 2
    await _lapse((SubscriptionCycle, cycle), *((Booking, v) for v in visits))

    async with get_sessionmaker()() as payment, payment.begin():
        locked = select(SubscriptionCycle).where(SubscriptionCycle.id == cycle).with_for_update()
        await payment.execute(locked)
        assert await _sweep() == 0
    assert [await _status(Booking, v) for v in visits] == ["held"] * len(visits)

    assert await _sweep() == len(visits)
    assert [await _status(Booking, v) for v in visits] == ["expired"] * len(visits)
    assert await _status(SubscriptionCycle, cycle) == "expired"
    assert await _status(Subscription, subscription["id"]) == "expired"


async def test_background_sweeper_releases_holds_nobody_reads(
    client: AsyncClient, customer, world, monkeypatch: pytest.MonkeyPatch
) -> None:
    booking = (await hold(client, customer, world, future_weekday())).json()
    await _lapse((Booking, booking["id"]))
    monkeypatch.setenv("HOLD_SWEEP_INTERVAL_SECONDS", "0.05")
    get_settings.cache_clear()
    try:
        app = create_app()
        async with app.router.lifespan_context(app):
            for _ in range(NO_WAIT * 20):
                if await _status(Booking, booking["id"]) == BookingStatus.expired:
                    break
                await asyncio.sleep(0.05)
    finally:
        get_settings.cache_clear()
    assert await _status(Booking, booking["id"]) == BookingStatus.expired
