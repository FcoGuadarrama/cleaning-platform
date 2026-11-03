"""Integration tests run against this worktree's MySQL `app_test` schema — never SQLite."""

import os
import subprocess
from collections.abc import AsyncIterator
from datetime import datetime, time, timedelta
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]
os.environ.setdefault("SANDBOX_WEBHOOK_SECRET", "test-only-secret")

from app.core.config import get_settings  # noqa: E402
from app.core.db import get_engine, get_sessionmaker  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models import Base, Role  # noqa: E402
from app.services import auth  # noqa: E402

PASSWORD = "correct-horse-battery"


@pytest.fixture(scope="session", autouse=True)
def migrated() -> None:
    assert "_test" in os.environ["DATABASE_URL"], "refusing to run tests outside a *_test schema"
    for args in (["downgrade", "base"], ["upgrade", "head"]):
        subprocess.run(["alembic", *args], check=True, env=os.environ.copy())


@pytest.fixture(autouse=True)
async def clean_db() -> AsyncIterator[None]:
    async with get_engine().begin() as conn:
        await conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))
        for table in Base.metadata.sorted_tables:
            await conn.execute(text(f"TRUNCATE TABLE `{table.name}`"))
        await conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))
    yield


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=create_app()), base_url="http://test") as c:
        yield c


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def login(client: AsyncClient, email: str) -> dict[str, str]:
    r = await client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return bearer(r.json()["access_token"])


@pytest.fixture
async def admin(client: AsyncClient) -> dict[str, str]:
    async with get_sessionmaker()() as session, session.begin():
        await auth.create_user(session, "admin@admin.com", PASSWORD, "Admin", Role.admin)
    return await login(client, "admin@admin.com")


async def register(client: AsyncClient, email: str) -> dict[str, str]:
    r = await client.post(
        "/auth/register", json={"email": email, "password": PASSWORD, "full_name": "Cliente"}
    )
    assert r.status_code == 201, r.text
    return bearer(r.json()["access_token"])


@pytest.fixture
async def customer(client: AsyncClient) -> dict[str, str]:
    return await register(client, "test@test.com")


@pytest.fixture
async def world(client: AsyncClient, admin: dict[str, str]) -> dict[str, Any]:
    staff = await client.post(
        "/admin/staff",
        headers=admin,
        json={
            "email": "staff1@test.com",
            "password": PASSWORD,
            "full_name": "Staff Uno",
            "display_name": "Ana",
        },
    )
    assert staff.status_code == 201, staff.text
    # Test fixture values only — not business prices.
    offering = await client.post(
        "/admin/offerings",
        headers=admin,
        json={
            "name": "Visita prueba",
            "duration_minutes": 120,
            "price_minor": 10000,
            "staff_earning_minor": 4000,
        },
    )
    assert offering.status_code == 201, offering.text
    return {
        "staff_id": staff.json()["id"],
        "offering_id": offering.json()["id"],
        "staff": await login(client, "staff1@test.com"),
    }


def future_weekday(hour: int = 10, days_ahead: int = 3) -> datetime:
    tz = get_settings().business_tz
    day = datetime.now(tz).date() + timedelta(days=days_ahead)
    while day.weekday() > 4:
        day += timedelta(days=1)
    return datetime.combine(day, time(hour), tz)


async def hold(client: AsyncClient, headers: dict[str, str], world: dict[str, Any], start: datetime) -> Any:
    return await client.post(
        "/bookings",
        headers=headers,
        json={
            "staff_id": world["staff_id"],
            "offering_id": world["offering_id"],
            "starts_at": start.isoformat(),
            "address": "Calle Prueba 123, Veracruz",
        },
    )


async def paid_booking(client: AsyncClient, customer: dict[str, str], world: dict[str, Any]) -> int:
    booking = (await hold(client, customer, world, future_weekday())).json()
    payment = (await client.post(f"/bookings/{booking['id']}/checkout", headers=customer)).json()
    r = await client.post(f"/payments/{payment['id']}/sandbox-outcome", headers=customer, json={})
    assert r.json()["status"] == "succeeded", r.text
    return int(booking["id"])
