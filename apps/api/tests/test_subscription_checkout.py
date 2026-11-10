import asyncio
from datetime import date, datetime, time, timedelta
from typing import Any

from httpx import AsyncClient
from sqlalchemy import select, update

from app.core.config import get_settings
from app.core.db import get_sessionmaker
from app.core.timeutil import utcnow
from app.models import Booking, Earning, SubscriptionCycle
from tests.conftest import hold, register, saved_address
from tests.test_subscription_plans import PLAN, create_plan

NOW = {"capture_status": "captured", "latitude": 19.18, "longitude": -96.14, "accuracy_m": 10}


def next_weekday(weekday: int, min_days: int = 2) -> date:
    day = datetime.now(get_settings().business_tz).date() + timedelta(days=min_days)
    while day.weekday() != weekday:
        day += timedelta(days=1)
    return day


async def choice(
    client: AsyncClient, customer: dict[str, str], world: dict[str, Any], plan: Any, **over: Any
):
    address = await saved_address(client, customer)
    weekdays = over.pop("weekdays", [1, 3][: plan["days_per_week"]])
    return {
        "plan_id": plan["id"],
        "staff_id": world["staff_id"],
        "address_id": address["id"],
        "weekdays": weekdays,
        "starts_on": next_weekday(weekdays[0]).isoformat(),
        "visit_start": "10:00",
        "accept_terms": True,
        **over,
    }


async def contract(client: AsyncClient, customer: dict[str, str], body: dict[str, Any]) -> Any:
    r = await client.post("/subscriptions", headers=customer, json=body)
    assert r.status_code == 201, r.text
    return r.json()


async def pay(
    client: AsyncClient, customer: dict[str, str], subscription_id: int, outcome: str = "succeeded"
):
    payment = await client.post(f"/subscriptions/{subscription_id}/checkout", headers=customer)
    assert payment.status_code == 201, payment.text
    r = await client.post(
        f"/payments/{payment.json()['id']}/sandbox-outcome", headers=customer, json={"outcome": outcome}
    )
    assert r.status_code == 200, r.text
    return payment.json()


async def test_schedule_lists_every_visit_and_only_times_free_on_all_of_them(
    client: AsyncClient, admin, customer, world
) -> None:
    plan = await create_plan(client, admin, days_per_week=2, visit_duration_minutes=120)
    starts_on = next_weekday(1)
    params = {"staff_id": world["staff_id"], "starts_on": starts_on.isoformat(), "weekdays": [1, 3]}
    url = f"/subscription-plans/{plan['id']}/schedule"
    before = (await client.get(url, headers=customer, params=params)).json()
    assert len(before["visit_dates"]) == 8 and before["visit_dates"][0] == starts_on.isoformat()
    assert before["ends_on"] == (starts_on + timedelta(days=27)).isoformat()
    assert before["renews_on"] == (starts_on + timedelta(days=28)).isoformat()
    assert "10:00:00" in before["start_times"]
    # Someone books the third visit's date at 10:00: that time is no longer free for the whole cycle.
    third = date.fromisoformat(before["visit_dates"][2])
    other = await register(client, "other@test.com")
    tz = get_settings().business_tz
    assert (await hold(client, other, world, datetime.combine(third, time(10), tz))).status_code == 201
    after = (await client.get(url, headers=customer, params=params)).json()
    assert "10:00:00" not in after["start_times"] and "08:00:00" not in after["start_times"]
    assert "14:00:00" in after["start_times"]


async def test_contract_pay_and_see_the_confirmed_cycle(client: AsyncClient, admin, customer, world) -> None:
    plan = await create_plan(client, admin, days_per_week=2, staff_earning_minor=15000)
    held = await contract(client, customer, await choice(client, customer, world, plan))
    assert held["status"] == "held" and held["renews_on"] is None
    [cycle] = held["cycles"]
    assert cycle["status"] == "held" and cycle["price_minor"] == PLAN["price_minor"]
    assert len(cycle["visits"]) == 8
    assert {(v["status"], v["price_minor"], v["offering_id"]) for v in cycle["visits"]} == {("held", 0, None)}
    assert "staff_earning_minor" not in held
    # Pending visits live under the subscription, not in the customer's visit list.
    assert (await client.get("/bookings", headers=customer)).json() == []

    payment = await pay(client, customer, held["id"])
    assert payment["amount_minor"] == PLAN["price_minor"] and payment["booking_id"] is None
    active = (await client.get(f"/subscriptions/{held['id']}", headers=customer)).json()
    assert active["status"] == "active"
    [cycle] = active["cycles"]
    assert cycle["status"] == "confirmed" and cycle["hold_expires_at"] is None
    assert {v["status"] for v in cycle["visits"]} == {"confirmed"}
    renews = date.fromisoformat(cycle["ends_on"]) + timedelta(days=1)
    assert active["renews_on"] == renews.isoformat()
    listed = (await client.get("/bookings", headers=customer)).json()
    assert len(listed) == 8 and all(b["subscription_cycle_id"] == cycle["id"] for b in listed)
    assert [s["id"] for s in (await client.get("/subscriptions", headers=customer)).json()] == [held["id"]]


async def test_accepted_price_and_terms_survive_a_new_plan_version(
    client: AsyncClient, admin, customer, world
) -> None:
    plan = await create_plan(client, admin)
    held = await contract(client, customer, await choice(client, customer, world, plan))
    revised = await client.post(
        f"/admin/subscription-plans/{plan['id']}/versions",
        headers=admin,
        json={**PLAN, "price_minor": 999900, "terms": "Condiciones nuevas."},
    )
    assert revised.status_code == 201
    await pay(client, customer, held["id"])
    kept = (await client.get(f"/subscriptions/{held['id']}", headers=customer)).json()
    assert (kept["price_minor"], kept["terms"], kept["plan_id"]) == (
        PLAN["price_minor"],
        PLAN["terms"],
        plan["id"],
    )
    # The superseded version can no longer be contracted.
    again = await client.post(
        "/subscriptions", headers=customer, json=await choice(client, customer, world, plan)
    )
    assert again.status_code == 404


async def test_a_taken_visit_rejects_the_whole_hold_and_names_the_date(
    client: AsyncClient, admin, customer, world
) -> None:
    plan = await create_plan(client, admin, visit_duration_minutes=120)
    body = await choice(client, customer, world, plan)
    third = date.fromisoformat(body["starts_on"]) + timedelta(days=14)
    other = await register(client, "other@test.com")
    tz = get_settings().business_tz
    assert (await hold(client, other, world, datetime.combine(third, time(11), tz))).status_code == 201
    r = await client.post("/subscriptions", headers=customer, json=body)
    assert r.status_code == 409 and r.json()["code"] == "visits_unavailable"
    assert r.json()["details"] == {"dates": [third.isoformat()]}
    assert (await client.get("/subscriptions", headers=customer)).json() == []


async def test_concurrent_holds_for_the_same_cleaner_and_time_only_one_wins(
    client: AsyncClient, admin, world
) -> None:
    plan = await create_plan(client, admin)
    customers = [await register(client, f"c{i}@test.com") for i in range(4)]
    bodies = [await choice(client, c, world, plan) for c in customers]
    results = await asyncio.gather(
        *(client.post("/subscriptions", headers=c, json=b) for c, b in zip(customers, bodies, strict=True))
    )
    assert sorted(r.status_code for r in results) == [201, 409, 409, 409], [r.text for r in results]


async def test_lapsed_hold_releases_every_visit_and_a_late_payment_is_flagged(
    client: AsyncClient, admin, customer, world
) -> None:
    plan = await create_plan(client, admin)
    body = await choice(client, customer, world, plan)
    held = await contract(client, customer, body)
    payment = (await client.post(f"/subscriptions/{held['id']}/checkout", headers=customer)).json()
    past = utcnow() - timedelta(seconds=1)
    async with get_sessionmaker()() as s, s.begin():
        await s.execute(update(SubscriptionCycle).values(hold_expires_at=past))
        await s.execute(update(Booking).values(hold_expires_at=past))
    expired = (await client.get(f"/subscriptions/{held['id']}", headers=customer)).json()
    assert expired["status"] == "expired" and expired["cycles"][0]["status"] == "expired"
    assert {v["status"] for v in expired["cycles"][0]["visits"]} == {"expired"}
    assert (await client.get("/subscriptions", headers=customer)).json() == []
    again = await client.post(f"/subscriptions/{held['id']}/checkout", headers=customer)
    assert again.status_code == 409
    # A payment that lands after expiry confirms nothing and is flagged for refund.
    late = await client.post(f"/payments/{payment['id']}/sandbox-outcome", headers=customer, json={})
    assert late.json()["status"] == "succeeded"
    after = (await client.get(f"/subscriptions/{held['id']}", headers=customer)).json()
    assert after["status"] == "expired"
    # The same visits are free again for someone else.
    other = await register(client, "other@test.com")
    assert (
        await client.post("/subscriptions", headers=other, json=await choice(client, other, world, plan))
    ).status_code == 201


async def test_subscription_visits_flow_into_attendance_and_earnings(
    client: AsyncClient, admin, customer, world
) -> None:
    plan = await create_plan(client, admin, staff_earning_minor=15000)
    held = await contract(client, customer, await choice(client, customer, world, plan))
    await pay(client, customer, held["id"])
    staff_visits = (await client.get("/bookings", headers=world["staff"])).json()
    assert len(staff_visits) == 4
    first = staff_visits[0]["id"]
    for step in ("check-in", "check-out"):
        r = await client.post(
            f"/bookings/{first}/{step}",
            headers=world["staff"],
            json={**NOW, "occurred_at": utcnow().isoformat()},
        )
        assert r.status_code == 201, r.text
    async with get_sessionmaker()() as s:
        earning = (await s.execute(select(Earning).where(Earning.booking_id == first))).scalar_one()
    assert earning.amount_minor == 15000


async def test_choices_are_validated_and_owned(client: AsyncClient, admin, customer, world) -> None:
    plan = await create_plan(client, admin, days_per_week=2)
    body = await choice(client, customer, world, plan)
    for bad, code in (
        ({"weekdays": [1]}, "weekdays_mismatch"),
        ({"starts_on": next_weekday(0).isoformat()}, "start_not_on_weekday"),
        ({"starts_on": next_weekday(1, min_days=60).isoformat()}, "start_too_far"),
        ({"visit_start": "17:00"}, "outside_working_hours"),
    ):
        r = await client.post("/subscriptions", headers=customer, json={**body, **bad})
        assert (r.status_code, r.json()["code"]) == (400, code), bad
    for bad in ({"accept_terms": False}, {"weekdays": [1, 1]}, {"weekdays": [1, 6]}):
        assert (
            await client.post("/subscriptions", headers=customer, json={**body, **bad})
        ).status_code == 422
    other = await register(client, "other@test.com")
    stolen = await client.post("/subscriptions", headers=other, json=body)
    assert stolen.status_code == 404  # the address belongs to `customer`
    held = await contract(client, customer, body)
    assert (await client.get(f"/subscriptions/{held['id']}", headers=other)).status_code == 404
    assert (await client.post(f"/subscriptions/{held['id']}/checkout", headers=other)).status_code == 404
    assert (await client.post("/subscriptions", headers=world["staff"], json=body)).status_code == 403
    visit = held["cycles"][0]["visits"][0]["id"]
    # A held subscription visit is paid only with its cycle; on its own it is not even visible.
    assert (await client.post(f"/bookings/{visit}/checkout", headers=customer)).status_code == 404


async def test_admin_sees_every_subscription_with_cleaner_pay(
    client: AsyncClient, admin, customer, world
) -> None:
    plan = await create_plan(client, admin, staff_earning_minor=15000)
    held = await contract(client, customer, await choice(client, customer, world, plan))
    listed = (await client.get("/admin/subscriptions", headers=admin)).json()
    assert [(s["id"], s["staff_earning_minor"], s["status"]) for s in listed] == [(held["id"], 15000, "held")]
    detail = (await client.get(f"/admin/subscriptions/{held['id']}", headers=admin)).json()
    assert detail["customer_id"] == held["cycles"][0]["visits"][0]["customer_id"]
    assert len(detail["cycles"][0]["visits"]) == 4
    assert (await client.get("/admin/subscriptions", headers=customer)).status_code == 403
    assert (await client.get("/admin/subscriptions/999999", headers=admin)).status_code == 404
