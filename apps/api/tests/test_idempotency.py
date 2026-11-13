import asyncio
from datetime import datetime, timedelta
from typing import Any

from httpx import ASGITransport, AsyncClient
from sqlalchemy import update

from app.core.db import get_sessionmaker
from app.core.timeutil import utcnow
from app.main import create_app
from app.models import Booking
from tests.conftest import future_weekday, hold, register, saved_address
from tests.test_subscription_checkout import choice
from tests.test_subscription_plans import create_plan


async def _body(client: AsyncClient, headers: dict[str, str], world: dict[str, Any], start: datetime) -> Any:
    address = await saved_address(client, headers)
    return {
        "staff_id": world["staff_id"],
        "offering_id": world["offering_id"],
        "starts_at": start.isoformat(),
        "address_id": address["id"],
    }


async def _hold(client: AsyncClient, headers: dict[str, str], body: Any, key: str) -> Any:
    return await client.post("/bookings", headers={**headers, "Idempotency-Key": key}, json=body)


async def test_retry_with_same_key_returns_the_first_hold(client: AsyncClient, customer, world) -> None:
    body = await _body(client, customer, world, future_weekday())
    first = await _hold(client, customer, body, "k-1")
    retry = await _hold(client, customer, body, "k-1")
    assert first.status_code == retry.status_code == 201, retry.text
    assert retry.json()["id"] == first.json()["id"]
    assert len((await client.get("/bookings", headers=customer)).json()) == 1


async def test_retry_without_key_conflicts_with_own_hold(client: AsyncClient, customer, world) -> None:
    start = future_weekday()
    assert (await hold(client, customer, world, start)).status_code == 201
    r = await hold(client, customer, world, start)
    assert r.status_code == 409 and r.json()["code"] == "slot_unavailable"


async def test_same_key_for_a_different_request_is_rejected(client: AsyncClient, customer, world) -> None:
    body = await _body(client, customer, world, future_weekday(hour=9))
    assert (await _hold(client, customer, body, "k-1")).status_code == 201
    other = {**body, "starts_at": future_weekday(hour=14).isoformat()}
    r = await _hold(client, customer, other, "k-1")
    assert r.status_code == 409 and r.json()["code"] == "idempotency_key_reused"


async def test_concurrent_attempts_with_same_key_create_one_hold(
    client: AsyncClient, customer, world
) -> None:
    body = await _body(client, customer, world, future_weekday())
    results = await asyncio.gather(*(_hold(client, customer, body, "k-1") for _ in range(5)))
    assert [r.status_code for r in results] == [201] * 5, [r.text for r in results]
    assert len({r.json()["id"] for r in results}) == 1


async def test_keys_are_scoped_per_customer(client: AsyncClient, customer, world) -> None:
    other = await register(client, "other@test.com")
    mine = await _hold(client, customer, await _body(client, customer, world, future_weekday(hour=9)), "k-1")
    theirs = await _hold(client, other, await _body(client, other, world, future_weekday(hour=14)), "k-1")
    assert mine.status_code == theirs.status_code == 201
    assert mine.json()["id"] != theirs.json()["id"]


async def test_failed_attempt_does_not_burn_the_key(client: AsyncClient, customer, world) -> None:
    start = future_weekday()
    other = await register(client, "other@test.com")
    taken = (await hold(client, other, world, start)).json()
    body = await _body(client, customer, world, start)
    assert (await _hold(client, customer, body, "k-1")).json()["code"] == "slot_unavailable"
    async with get_sessionmaker()() as session, session.begin():
        lapsed = utcnow() - timedelta(minutes=1)
        await session.execute(update(Booking).where(Booking.id == taken["id"]).values(hold_expires_at=lapsed))
    assert (await _hold(client, customer, body, "k-1")).status_code == 201


async def test_subscription_retry_with_same_key_returns_the_first_hold(
    client: AsyncClient, admin, customer, world
) -> None:
    plan = await create_plan(client, admin, days_per_week=1)
    body = await choice(client, customer, world, plan)
    headers = {**customer, "Idempotency-Key": "sub-1"}
    first = await client.post("/subscriptions", headers=headers, json=body)
    retry = await client.post("/subscriptions", headers=headers, json=body)
    assert first.status_code == retry.status_code == 201, retry.text
    assert retry.json()["id"] == first.json()["id"]
    assert len((await client.get("/subscriptions", headers=customer)).json()) == 1


async def test_browser_preflight_allows_the_idempotency_header(monkeypatch) -> None:
    """The Expo web app is another origin: without the header in CORS the browser never sends the POST."""
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:8081")
    async with AsyncClient(transport=ASGITransport(app=create_app()), base_url="http://test") as browser:
        r = await browser.options(
            "/bookings",
            headers={
                "Origin": "http://localhost:8081",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type,idempotency-key",
            },
        )
    assert r.status_code == 200, r.text
