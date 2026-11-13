import asyncio

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_sessionmaker, retry_on_lock_conflict
from app.core.errors import AppError
from app.models import Role, User
from app.payments import sandbox
from app.services import auth, payments
from tests.conftest import future_weekday, hold


async def _users(count: int) -> list[int]:
    async with get_sessionmaker()() as session, session.begin():
        users = [
            await auth.create_user(session, f"lock{i}@test.com", "x" * 12, "Lock", Role.customer)
            for i in range(count)
        ]
        return [u.id for u in users]


async def test_real_deadlock_is_retried_until_both_transactions_commit() -> None:
    """Two transactions lock the same two rows in opposite order: InnoDB aborts one, the retry finishes it."""
    first_id, second_id = await _users(2)
    both_hold_their_first_row = asyncio.Barrier(2)
    attempts: list[str] = []

    @retry_on_lock_conflict
    async def lock_in_order(session: AsyncSession, name: str, order: tuple[int, int]) -> None:
        attempts.append(name)
        async with session.begin():
            await session.execute(select(User).where(User.id == order[0]).with_for_update())
            if attempts.count(name) == 1:
                await both_hold_their_first_row.wait()
            await session.execute(select(User).where(User.id == order[1]).with_for_update())

    async with get_sessionmaker()() as a, get_sessionmaker()() as b:
        await asyncio.gather(
            lock_in_order(a, "a", (first_id, second_id)), lock_in_order(b, "b", (second_id, first_id))
        )
    assert len(attempts) == 3


async def test_lock_conflict_gives_up_with_503() -> None:
    calls = 0

    @retry_on_lock_conflict
    async def always_deadlocks() -> None:
        nonlocal calls
        calls += 1
        raise OperationalError("UPDATE", {}, Exception(1213, "Deadlock found"))

    with pytest.raises(AppError) as raised:
        await always_deadlocks()
    assert (raised.value.status, raised.value.code, calls) == (503, "database_busy", 3)


async def test_other_operational_errors_are_not_retried() -> None:
    calls = 0

    @retry_on_lock_conflict
    async def server_gone() -> None:
        nonlocal calls
        calls += 1
        raise OperationalError("SELECT", {}, Exception(2006, "MySQL server has gone away"))

    with pytest.raises(OperationalError):
        await server_gone()
    assert calls == 1


async def test_webhook_failure_is_not_acknowledged_as_a_replay(
    client: AsyncClient, customer, world, monkeypatch: pytest.MonkeyPatch
) -> None:
    booking = (await hold(client, customer, world, future_weekday())).json()
    payment = (await client.post(f"/bookings/{booking['id']}/checkout", headers=customer)).json()
    body, sig = sandbox.build_event(payment["provider_ref"], "succeeded")
    headers = {"x-sandbox-signature": sig, "content-type": "application/json"}

    async def broken(*_: object) -> None:
        raise IntegrityError("INSERT", {}, Exception(1452, "Cannot add or update a child row"))

    with monkeypatch.context() as patched:
        patched.setattr(payments, "_apply_event", broken)
        with pytest.raises(IntegrityError):
            await client.post("/payments/webhooks/sandbox", content=body, headers=headers)
    redelivered = await client.post("/payments/webhooks/sandbox", content=body, headers=headers)
    assert redelivered.json() == {"received": True, "duplicate": False}
    assert (await client.get(f"/bookings/{booking['id']}", headers=customer)).json()["status"] == "confirmed"
