from datetime import UTC, datetime

from httpx import AsyncClient

from app.services.attendance import week_start_for
from tests.conftest import future_weekday, paid_booking

GPS = {"capture_status": "captured", "latitude": 19.18, "longitude": -96.14, "accuracy_m": 12.0}


def _now() -> str:
    return datetime.now(UTC).isoformat()


async def test_happy_path_completion_creates_earning_then_settle_and_pay(
    client: AsyncClient, admin, customer, world
) -> None:
    bid = await paid_booking(client, customer, world)
    staff = world["staff"]
    assert (
        await client.post(f"/bookings/{bid}/check-in", headers=staff, json={**GPS, "occurred_at": _now()})
    ).status_code == 201
    r = await client.post(f"/bookings/{bid}/check-out", headers=staff, json={**GPS, "occurred_at": _now()})
    assert r.status_code == 201
    assert (await client.get(f"/bookings/{bid}", headers=staff)).json()["status"] == "completed"

    week = week_start_for(future_weekday()).isoformat()
    summary = (await client.get("/me/earnings", headers=staff, params={"week_start": week})).json()
    assert (summary["earned_minor"], summary["approved_minor"], summary["paid_minor"]) == (4000, 0, 0)

    s = await client.post(
        "/admin/settlements", headers=admin, json={"staff_id": world["staff_id"], "week_start": week}
    )
    assert s.status_code == 201 and s.json()["total_minor"] == 4000
    summary = (await client.get("/me/earnings", headers=staff, params={"week_start": week})).json()
    assert (summary["earned_minor"], summary["approved_minor"], summary["paid_minor"]) == (0, 4000, 0)

    p = await client.post(
        f"/admin/settlements/{s.json()['id']}/payout", headers=admin, json={"reference": "TRF-1"}
    )
    assert p.json()["status"] == "paid"
    summary = (await client.get("/me/earnings", headers=staff, params={"week_start": week})).json()
    assert (summary["earned_minor"], summary["approved_minor"], summary["paid_minor"]) == (0, 0, 4000)
    again = await client.post(
        f"/admin/settlements/{s.json()['id']}/payout", headers=admin, json={"reference": "x"}
    )
    assert again.status_code == 409


async def test_failed_gps_is_never_recorded_as_success(client: AsyncClient, admin, customer, world) -> None:
    bid = await paid_booking(client, customer, world)
    staff = world["staff"]
    r = await client.post(
        f"/bookings/{bid}/check-in",
        headers=staff,
        json={"capture_status": "permission_denied", "occurred_at": _now()},
    )
    assert r.json()["capture_status"] == "permission_denied" and r.json()["latitude"] is None
    await client.post(f"/bookings/{bid}/check-out", headers=staff, json={**GPS, "occurred_at": _now()})
    assert (await client.get(f"/bookings/{bid}", headers=staff)).json()["status"] == "pending_review"
    week = week_start_for(future_weekday()).isoformat()
    assert (await client.get("/me/earnings", headers=staff, params={"week_start": week})).json()[
        "items"
    ] == []

    exceptions = (await client.get("/admin/attendance-exceptions", headers=admin)).json()
    assert [e["reason"] for e in exceptions] == ["permission_denied"]
    res = await client.post(
        f"/admin/attendance-exceptions/{exceptions[0]['id']}/resolve",
        headers=admin,
        json={"approve": True, "note": "Confirmado por llamada con cliente"},
    )
    assert res.json()["status"] == "approved"
    assert (await client.get(f"/bookings/{bid}", headers=staff)).json()["status"] == "completed"
    assert (
        len((await client.get("/me/earnings", headers=staff, params={"week_start": week})).json()["items"])
        == 1
    )


async def test_rejected_exception_disputes_without_earning(
    client: AsyncClient, admin, customer, world
) -> None:
    bid = await paid_booking(client, customer, world)
    staff = world["staff"]
    await client.post(
        f"/bookings/{bid}/check-in",
        headers=staff,
        json={"capture_status": "unavailable", "occurred_at": _now()},
    )
    exc = (await client.get("/admin/attendance-exceptions", headers=admin)).json()[0]
    await client.post(
        f"/admin/attendance-exceptions/{exc['id']}/resolve",
        headers=admin,
        json={"approve": False, "note": "No asistió"},
    )
    await client.post(f"/bookings/{bid}/check-out", headers=staff, json={**GPS, "occurred_at": _now()})
    assert (await client.get(f"/bookings/{bid}", headers=staff)).json()["status"] == "disputed"


async def test_captured_without_coordinates_rejected(client: AsyncClient, customer, world) -> None:
    bid = await paid_booking(client, customer, world)
    r = await client.post(
        f"/bookings/{bid}/check-in",
        headers=world["staff"],
        json={"capture_status": "captured", "occurred_at": _now()},
    )
    assert r.status_code == 400 and r.json()["code"] == "gps_incomplete"


async def test_admin_manual_attendance_for_connectivity_failure(
    client: AsyncClient, admin, customer, world
) -> None:
    bid = await paid_booking(client, customer, world)
    for kind in ("check_in", "check_out"):
        r = await client.post(
            f"/admin/bookings/{bid}/manual-attendance",
            headers=admin,
            json={"kind": kind, "occurred_at": _now(), "reason": "Sin señal; confirmado por teléfono"},
        )
        assert r.status_code == 201 and r.json()["capture_status"] == "admin_manual"
    assert (await client.get(f"/bookings/{bid}", headers=admin)).json()["status"] == "completed"


async def test_staff_cannot_check_in_unassigned_booking(client: AsyncClient, admin, customer, world) -> None:
    bid = await paid_booking(client, customer, world)
    await client.post(
        "/admin/staff",
        headers=admin,
        json={
            "email": "staff2@test.com",
            "password": "correct-horse-battery",
            "full_name": "S2",
            "display_name": "Bea",
        },
    )
    r = await client.post(
        "/auth/login", json={"email": "staff2@test.com", "password": "correct-horse-battery"}
    )
    other = {"Authorization": f"Bearer {r.json()['access_token']}"}
    resp = await client.post(f"/bookings/{bid}/check-in", headers=other, json={**GPS, "occurred_at": _now()})
    assert resp.status_code == 404
