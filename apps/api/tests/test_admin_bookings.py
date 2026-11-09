from datetime import timedelta

from httpx import AsyncClient
from sqlalchemy import select, update

from app.core.db import get_sessionmaker
from app.core.timeutil import utcnow
from app.models import AuditLog, Booking, Payment
from tests.conftest import future_weekday, hold, paid_booking

REASON = {"reason": "El cliente llamó para cancelar"}


async def test_admin_cancels_paid_booking_and_flags_refund(
    client: AsyncClient, admin, customer, world
) -> None:
    booking_id = await paid_booking(client, customer, world)
    r = await client.post(f"/admin/bookings/{booking_id}/cancel", headers=admin, json=REASON)
    assert r.status_code == 200, r.text
    assert r.json()["refund_required"] is True
    assert r.json()["booking"]["status"] == "cancelled"
    async with get_sessionmaker()() as s:
        payment = (await s.execute(select(Payment).where(Payment.booking_id == booking_id))).scalar_one()
        log = (await s.execute(select(AuditLog).where(AuditLog.action == "booking.cancelled"))).scalar_one()
    assert payment.needs_refund is True
    assert log.actor_id is not None and log.data["reason"] == REASON["reason"]
    assert log.data["previous_status"] == "confirmed"
    # The freed slot can be booked again.
    assert (await hold(client, customer, world, future_weekday())).status_code == 201


async def test_admin_cancels_held_booking_without_refund(client: AsyncClient, admin, customer, world) -> None:
    booking = (await hold(client, customer, world, future_weekday())).json()
    r = await client.post(f"/admin/bookings/{booking['id']}/cancel", headers=admin, json=REASON)
    assert r.status_code == 200, r.text
    assert r.json() == {
        "booking": {**booking, "status": "cancelled", "hold_expires_at": None},
        "refund_required": False,
    }
    # A cancelled hold can no longer be paid.
    payment = await client.post(f"/bookings/{booking['id']}/checkout", headers=customer)
    assert payment.status_code == 409 and payment.json()["code"] == "booking_not_payable"


async def test_cancel_rejects_non_cancellable_states(client: AsyncClient, admin, customer, world) -> None:
    booking_id = await paid_booking(client, customer, world)
    first = await client.post(f"/admin/bookings/{booking_id}/cancel", headers=admin, json=REASON)
    assert first.status_code == 200
    again = await client.post(f"/admin/bookings/{booking_id}/cancel", headers=admin, json=REASON)
    assert again.status_code == 409 and again.json()["code"] == "invalid_booking_state"
    missing = await client.post("/admin/bookings/999999/cancel", headers=admin, json=REASON)
    assert missing.status_code == 404


async def test_cancel_requires_admin_and_reason(client: AsyncClient, admin, customer, world) -> None:
    booking_id = await paid_booking(client, customer, world)
    for headers in (customer, world["staff"]):
        r = await client.post(f"/admin/bookings/{booking_id}/cancel", headers=headers, json=REASON)
        assert r.status_code == 403
    short = await client.post(f"/admin/bookings/{booking_id}/cancel", headers=admin, json={"reason": "x"})
    assert short.status_code == 422


async def test_expired_holds_are_marked_on_read(client: AsyncClient, admin, customer, world) -> None:
    booking = (await hold(client, customer, world, future_weekday())).json()
    async with get_sessionmaker()() as s, s.begin():
        await s.execute(
            update(Booking)
            .where(Booking.id == booking["id"])
            .values(hold_expires_at=utcnow() - timedelta(seconds=1))
        )
    listed = (await client.get("/bookings", headers=admin)).json()
    assert [b["status"] for b in listed] == ["expired"]
    cancel = await client.post(f"/admin/bookings/{booking['id']}/cancel", headers=admin, json=REASON)
    assert cancel.status_code == 409


async def test_admin_lists_customers_only(client: AsyncClient, admin, customer, world) -> None:
    r = await client.get("/admin/customers", headers=admin)
    assert r.status_code == 200
    assert [(u["email"], u["role"]) for u in r.json()] == [("test@test.com", "customer")]
    assert (await client.get("/admin/customers", headers=customer)).status_code == 403
