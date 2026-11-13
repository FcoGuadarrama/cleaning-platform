"""Owner decision 2026-11-11: a subscription blocks its cleaner on its weekdays and time until it is
deactivated, also in the cycles that do not exist yet."""

from datetime import date, datetime, time, timedelta

from httpx import AsyncClient

from app.core.config import get_settings
from app.services.commitments import Pattern
from tests.conftest import hold, register
from tests.test_subscription_checkout import choice, contract, pay
from tests.test_subscription_plans import create_plan

TUESDAY = 1


def _at(day: date, hour: int) -> datetime:
    return datetime.combine(day, time(hour), get_settings().business_tz)


async def _subscribe(client: AsyncClient, admin, customer, world, *, paid: bool = True, **over) -> date:
    """A one-day (Tuesday) plan at 10:00; returns the first visit date."""
    plan = await create_plan(client, admin, days_per_week=1)
    body = await choice(client, customer, world, plan, **over)
    subscription = await contract(client, customer, body)
    if paid:
        await pay(client, customer, subscription["id"])
    return date.fromisoformat(body["starts_on"])


async def test_active_subscription_blocks_its_cleaner_after_the_paid_cycle(
    client: AsyncClient, admin, customer, world
) -> None:
    first = await _subscribe(client, admin, customer, world)
    in_cycle_two = first + timedelta(weeks=5)
    other = await register(client, "other@test.com")

    r = await hold(client, other, world, _at(in_cycle_two, 10))
    assert r.status_code == 409 and r.json()["code"] == "slot_unavailable"
    params = {"offering_id": world["offering_id"], "day": in_cycle_two.isoformat()}
    slots = (
        await client.get(f"/staff/{world['staff_id']}/availability", headers=other, params=params)
    ).json()
    starts = {
        datetime.fromisoformat(s["starts_at"]).astimezone(get_settings().business_tz).hour
        for s in slots["slots"]
    }
    assert 10 not in starts and 16 in starts
    assert (await hold(client, other, world, _at(in_cycle_two + timedelta(days=1), 10))).status_code == 201


async def test_a_pending_subscription_blocks_while_its_hold_lives(
    client: AsyncClient, admin, customer, world
) -> None:
    first = await _subscribe(client, admin, customer, world, paid=False)
    other = await register(client, "other@test.com")
    r = await hold(client, other, world, _at(first + timedelta(weeks=6), 10))
    assert r.status_code == 409 and r.json()["code"] == "slot_unavailable"


async def test_contracting_rejects_a_time_taken_after_the_first_cycle(
    client: AsyncClient, admin, customer, world
) -> None:
    plan = await create_plan(client, admin, days_per_week=1)
    body = await choice(client, customer, world, plan)
    later = date.fromisoformat(body["starts_on"]) + timedelta(weeks=6)
    other = await register(client, "other@test.com")
    assert (await hold(client, other, world, _at(later, 10))).status_code == 201

    params = {"staff_id": world["staff_id"], "starts_on": body["starts_on"], "weekdays": [TUESDAY]}
    schedule = (
        await client.get(f"/subscription-plans/{plan['id']}/schedule", headers=customer, params=params)
    ).json()
    assert "10:00:00" not in schedule["start_times"] and "14:00:00" in schedule["start_times"]
    r = await client.post("/subscriptions", headers=customer, json=body)
    assert r.status_code == 409 and r.json()["details"]["dates"] == [later.isoformat()]


def test_two_patterns_on_a_shared_weekday_clash_from_the_day_both_run() -> None:
    hour = timedelta(hours=1)
    mine = Pattern(None, frozenset({0, 2}), time(10), 2 * hour, date(2027, 1, 4))
    later = Pattern(7, frozenset({2}), time(11), hour, date(2027, 1, 20))
    elsewhere = Pattern(8, frozenset({2}), time(15), hour, date(2027, 1, 4))
    assert mine.first_clash_with(later) == date(2027, 1, 20)
    assert mine.first_clash_with(elsewhere) is None
    assert mine.clash_days([], [later, elsewhere]) == [date(2027, 1, 20)]
