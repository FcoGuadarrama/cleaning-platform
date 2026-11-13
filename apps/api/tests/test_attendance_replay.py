from datetime import UTC, datetime, timedelta

from httpx import AsyncClient

from app.services.attendance import week_start_for
from tests.conftest import future_weekday, paid_booking
from tests.test_attendance_earnings import GPS


def _at(minutes_ago: int) -> str:
    return (datetime.now(UTC) - timedelta(minutes=minutes_ago)).isoformat()


async def _attend(client: AsyncClient, headers: dict[str, str], bid: int, step: str, body: dict) -> dict:
    r = await client.post(f"/bookings/{bid}/{step}", headers=headers, json=body)
    assert r.status_code == 201, r.text
    return r.json()


async def test_check_in_retry_returns_the_first_capture(client: AsyncClient, customer, world) -> None:
    """The app captures GPS again on every tap, so a retry never repeats the body: the first capture wins."""
    bid, staff = await paid_booking(client, customer, world), world["staff"]
    first = await _attend(client, staff, bid, "check-in", {**GPS, "occurred_at": _at(5)})
    retry = await _attend(client, staff, bid, "check-in", {**GPS, "latitude": 19.2, "occurred_at": _at(0)})
    assert retry == first
    assert (await client.get(f"/bookings/{bid}", headers=staff)).json()["status"] == "in_progress"


async def test_check_out_retry_after_completion_does_not_earn_twice(
    client: AsyncClient, customer, world
) -> None:
    bid, staff = await paid_booking(client, customer, world), world["staff"]
    await _attend(client, staff, bid, "check-in", {**GPS, "occurred_at": _at(90)})
    first = await _attend(client, staff, bid, "check-out", {**GPS, "occurred_at": _at(1)})
    retry = await _attend(client, staff, bid, "check-out", {**GPS, "occurred_at": _at(0)})
    assert retry["id"] == first["id"]
    week = week_start_for(future_weekday()).isoformat()
    earnings = (await client.get("/me/earnings", headers=staff, params={"week_start": week})).json()
    assert len(earnings["items"]) == 1


async def test_failed_capture_retry_opens_one_exception(client: AsyncClient, admin, customer, world) -> None:
    bid, staff = await paid_booking(client, customer, world), world["staff"]
    failed = {"capture_status": "unavailable", "occurred_at": _at(0)}
    for _ in range(2):
        await _attend(client, staff, bid, "check-in", failed)
    assert len((await client.get("/admin/attendance-exceptions", headers=admin)).json()) == 1


async def test_attendance_recorded_by_someone_else_conflicts(
    client: AsyncClient, admin, customer, world
) -> None:
    bid = await paid_booking(client, customer, world)
    manual = {"kind": "check_in", "occurred_at": _at(0), "reason": "Sin señal; confirmado por teléfono"}
    first = await client.post(f"/admin/bookings/{bid}/manual-attendance", headers=admin, json=manual)
    retry = await client.post(f"/admin/bookings/{bid}/manual-attendance", headers=admin, json=manual)
    assert first.status_code == retry.status_code == 201 and retry.json()["id"] == first.json()["id"]

    gps = {**GPS, "occurred_at": _at(0)}
    r = await client.post(f"/bookings/{bid}/check-in", headers=world["staff"], json=gps)
    assert r.status_code == 409 and r.json()["code"] == "attendance_exists"
