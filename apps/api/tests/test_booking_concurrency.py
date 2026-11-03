import asyncio
from datetime import timedelta

from httpx import AsyncClient

from tests.conftest import future_weekday, hold, register


async def test_concurrent_holds_for_same_slot_only_one_wins(client: AsyncClient, world) -> None:
    customers = [await register(client, f"c{i}@test.com") for i in range(5)]
    start = future_weekday()
    results = await asyncio.gather(*(hold(client, c, world, start) for c in customers))
    codes = sorted(r.status_code for r in results)
    assert codes == [201, 409, 409, 409, 409], [r.text for r in results]


async def test_travel_buffer_blocks_adjacent_slot(client: AsyncClient, customer, world) -> None:
    start = future_weekday(hour=9)
    assert (await hold(client, customer, world, start)).status_code == 201
    # 120-min visit ends 11:00; default 60-min buffer → 11:30 is blocked, 12:00 is free.
    assert (await hold(client, customer, world, start + timedelta(minutes=150))).status_code == 409
    assert (await hold(client, customer, world, start + timedelta(minutes=180))).status_code == 201


async def test_weekend_and_past_rejected(client: AsyncClient, customer, world) -> None:
    start = future_weekday()
    saturday = start + timedelta(days=(5 - start.weekday()))
    r = await hold(client, customer, world, saturday)
    assert r.json()["code"] == "not_business_day"
    r = await hold(client, customer, world, start - timedelta(days=30))
    assert r.status_code == 400


async def test_availability_excludes_held_slot(client: AsyncClient, customer, world) -> None:
    start = future_weekday()
    params = {"offering_id": world["offering_id"], "day": start.date().isoformat()}
    url = f"/staff/{world['staff_id']}/availability"
    before = (await client.get(url, headers=customer, params=params)).json()["slots"]
    await hold(client, customer, world, start)
    after = (await client.get(url, headers=customer, params=params)).json()["slots"]
    assert len(after) < len(before)
