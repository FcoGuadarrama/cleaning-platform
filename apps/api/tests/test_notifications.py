"""Owner decision 2026-11-13: an in-app inbox for every role, push to the mobile app through Expo, push muted
per category, day-before reminders and a notice to the cleaner for each new service."""

import json
from datetime import datetime, time, timedelta
from typing import Any

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy import select, update

from app.core.config import get_settings
from app.core.db import get_sessionmaker
from app.core.timeutil import utcnow
from app.models import Booking, Notification, OutboxMessage, PushDevice
from app.services import housekeeping, notifications, outbox, push, reminders
from tests.conftest import future_weekday, hold, paid_booking
from tests.test_attendance_replay import _at
from tests.test_renewals import _active, _run
from tests.test_spei import _spei_booking

TOKEN = "ExponentPushToken[customer-phone-1]"


async def _drain() -> None:
    """Delivers events (inbox rows + queued push), then the queued push."""
    for _ in range(2):
        async with get_sessionmaker()() as session:
            await outbox.dispatch(session, notifications.deliver)


async def _inbox(client: AsyncClient, headers: dict[str, str]) -> list[dict[str, Any]]:
    r = await client.get("/notifications", headers=headers)
    assert r.status_code == 200, r.text
    return list(r.json())


async def _outbox(topic: str) -> list[OutboxMessage]:
    async with get_sessionmaker()() as session:
        return list(await session.scalars(select(OutboxMessage).where(OutboxMessage.topic == topic)))


async def _register(client: AsyncClient, headers: dict[str, str], token: str = TOKEN) -> None:
    r = await client.put("/push-devices", headers=headers, json={"token": token, "platform": "ios"})
    assert r.status_code == 204, r.text


def _expo(monkeypatch: pytest.MonkeyPatch, tickets: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    """Routes push through the Expo provider against a fake Expo that answers `tickets`."""
    sent: list[list[dict[str, Any]]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == push.EXPO_SEND_URL
        sent.append(json.loads(request.content))
        return httpx.Response(200, json={"data": tickets})

    monkeypatch.setattr(push, "transport", httpx.MockTransport(handler))
    monkeypatch.setitem(push._PROVIDERS, "log", push._expo_provider)
    return sent


async def test_a_confirmed_visit_notifies_the_customer_and_the_cleaner_once(
    client: AsyncClient, customer, world
) -> None:
    bid = await paid_booking(client, customer, world)
    await _drain()
    [mine] = await _inbox(client, customer)
    assert (mine["kind"], mine["category"], mine["title"], mine["data"], mine["read_at"]) == (
        "booking.confirmed",
        "visits",
        "Visita confirmada",
        {"booking_id": bid},
        None,
    )
    assert "con Ana está confirmada" in mine["body"]
    [staff] = await _inbox(client, world["staff"])
    assert (staff["title"], staff["data"]) == ("Nuevo servicio asignado", {"booking_id": bid})
    assert [m.status for m in await _outbox("push.send")] == ["sent", "sent"]

    [event] = await _outbox("booking.confirmed")
    delivery = outbox.Delivery(event.id, event.key, event.topic, event.payload, event.attempts)
    async with get_sessionmaker()() as session:
        await notifications.deliver(session, delivery)
    assert len(await _inbox(client, customer)) == 1, "a redelivered event adds nothing"
    assert len(await _outbox("push.send")) == 2, "and queues no second push"


async def test_inbox_read_state_is_per_user(client: AsyncClient, customer, world) -> None:
    await paid_booking(client, customer, world)
    await _drain()
    [notice] = await _inbox(client, customer)
    count = await client.get("/notifications/unread-count", headers=customer)
    assert count.json() == {"count": 1}

    other = await client.post(f"/notifications/{notice['id']}/read", headers=world["staff"])
    assert other.status_code == 404
    read = await client.post(f"/notifications/{notice['id']}/read", headers=customer)
    assert read.status_code == 200 and read.json()["read_at"] is not None
    assert (await client.get("/notifications/unread-count", headers=customer)).json() == {"count": 0}
    assert (await client.get("/notifications/unread-count", headers=world["staff"])).json() == {"count": 1}

    assert (await client.post("/notifications/read-all", headers=world["staff"])).status_code == 204
    assert (await client.get("/notifications/unread-count", headers=world["staff"])).json() == {"count": 0}


async def test_a_user_deletes_only_their_own_notifications(client: AsyncClient, customer, world) -> None:
    await paid_booking(client, customer, world)
    await _drain()
    [notice] = await _inbox(client, customer)

    other = await client.delete(f"/notifications/{notice['id']}", headers=world["staff"])
    assert other.status_code == 404
    assert (await client.delete(f"/notifications/{notice['id']}", headers=customer)).status_code == 204
    assert await _inbox(client, customer) == []
    assert (await client.get("/notifications/unread-count", headers=customer)).json() == {"count": 0}
    assert len(await _inbox(client, world["staff"])) == 1, "the cleaner keeps theirs"
    assert (await client.delete(f"/notifications/{notice['id']}", headers=customer)).status_code == 404


async def test_inbox_pages_back_newest_first(client: AsyncClient, admin, customer, world) -> None:
    bid = await paid_booking(client, customer, world)
    cancel = await client.post(f"/admin/bookings/{bid}/cancel", headers=admin, json={"reason": "Prueba"})
    assert cancel.status_code == 200, cancel.text
    await _drain()
    newest, older = await _inbox(client, customer)
    assert (newest["kind"], older["kind"]) == ("booking.cancelled", "booking.confirmed")
    page = await client.get(f"/notifications?before_id={newest['id']}&limit=1", headers=customer)
    assert [n["id"] for n in page.json()] == [older["id"]]
    [cancelled, _] = await _inbox(client, world["staff"])
    assert cancelled["title"] == "Servicio cancelado", "the cleaner knew the visit, so hears it is off"


async def test_push_goes_to_every_active_device_through_expo(
    client: AsyncClient, customer, world, monkeypatch: pytest.MonkeyPatch
) -> None:
    other = "ExponentPushToken[customer-phone-2]"
    await _register(client, customer)
    await _register(client, customer, other)
    sent = _expo(monkeypatch, [{"status": "ok", "id": "a"}, {"status": "ok", "id": "b"}])
    bid = await paid_booking(client, customer, world)
    await _drain()

    [request] = sent
    assert [m["to"] for m in request] == [TOKEN, other]
    notice = (await _inbox(client, customer))[0]
    assert request[0] | {"to": None} == {
        "to": None,
        "title": "Visita confirmada",
        "body": notice["body"],
        "data": {"booking_id": bid, "notification_id": notice["id"]},
        "sound": "default",
        "channelId": "default",
    }


async def test_unregistered_devices_are_disabled_and_other_errors_retry(
    client: AsyncClient, customer, world, monkeypatch: pytest.MonkeyPatch
) -> None:
    gone = "ExponentPushToken[old-phone]"
    await _register(client, customer, gone)
    await _register(client, customer)
    _expo(
        monkeypatch,
        [
            {"status": "error", "message": "gone", "details": {"error": "DeviceNotRegistered"}},
            {"status": "error", "message": "Rate exceeded", "details": {"error": "MessageRateExceeded"}},
        ],
    )
    await paid_booking(client, customer, world)
    await _drain()

    async with get_sessionmaker()() as session:
        devices = {d.token: d.disabled_at for d in await session.scalars(select(PushDevice))}
    assert devices[gone] is not None and devices[TOKEN] is None
    customer_push = [m for m in await _outbox("push.send") if m.status != "sent"]
    assert [(m.status, m.attempts) for m in customer_push] == [("pending", 1)]
    assert "Rate exceeded" in (customer_push[0].last_error or "")


async def test_a_muted_category_keeps_the_inbox_but_sends_no_push(
    client: AsyncClient, customer, world, monkeypatch: pytest.MonkeyPatch
) -> None:
    prefs = await client.get("/notification-preferences", headers=customer)
    assert prefs.json() == [
        {"category": "visits", "push_enabled": True},
        {"category": "billing", "push_enabled": True},
    ]
    muted = await client.put(
        "/notification-preferences/visits", headers=customer, json={"push_enabled": False}
    )
    assert muted.json() == {"category": "visits", "push_enabled": False}
    await _register(client, customer)
    sent = _expo(monkeypatch, [{"status": "ok"}])

    await paid_booking(client, customer, world)
    await _drain()
    assert sent == []
    assert len(await _inbox(client, customer)) == 1

    wrong = await client.put(
        "/notification-preferences/payouts", headers=customer, json={"push_enabled": False}
    )
    assert wrong.status_code == 400 and wrong.json()["code"] == "invalid_category"
    staff = await client.get("/notification-preferences", headers=world["staff"])
    assert [p["category"] for p in staff.json()] == ["visits", "payouts"]


async def test_a_token_belongs_to_whoever_registered_it_last(
    client: AsyncClient, admin, customer, world
) -> None:
    await _register(client, customer)
    await _register(client, world["staff"])
    async with get_sessionmaker()() as session:
        [device] = await session.scalars(select(PushDevice))
    staff_user = (await client.get("/auth/me", headers=world["staff"])).json()["id"]
    assert (device.user_id, device.disabled_at) == (staff_user, None)

    assert (await client.delete(f"/push-devices/{TOKEN}", headers=customer)).status_code == 204
    async with get_sessionmaker()() as session:
        assert (await session.get(PushDevice, device.id)).disabled_at is None, "not the caller's token"  # type: ignore[union-attr]
    assert (await client.delete(f"/push-devices/{TOKEN}", headers=world["staff"])).status_code == 204
    async with get_sessionmaker()() as session:
        assert (await session.get(PushDevice, device.id)).disabled_at is not None  # type: ignore[union-attr]

    body = {"token": "ExponentPushToken[admin]", "platform": "ios"}
    assert (await client.put("/push-devices", headers=admin, json=body)).status_code == 403
    bad = {"token": "not-a-token", "platform": "ios"}
    assert (await client.put("/push-devices", headers=customer, json=bad)).status_code == 422


async def test_only_the_newest_devices_of_a_user_stay_active(client: AsyncClient, customer) -> None:
    for i in range(push.MAX_DEVICES_PER_USER + 2):
        await _register(client, customer, f"ExponentPushToken[phone-{i}]")
    async with get_sessionmaker()() as session:
        active = list(await session.scalars(select(PushDevice.token).where(PushDevice.disabled_at.is_(None))))
    assert len(active) == push.MAX_DEVICES_PER_USER
    assert "ExponentPushToken[phone-0]" not in active and "ExponentPushToken[phone-11]" in active


async def test_reminders_go_out_once_the_evening_before(client: AsyncClient, customer, world) -> None:
    bid = await paid_booking(client, customer, world)
    async with get_sessionmaker()() as session:
        starts_at = await session.scalar(select(Booking.starts_at).where(Booking.id == bid))
    assert starts_at is not None
    tz = get_settings().business_tz
    eve = starts_at.astimezone(tz).date() - timedelta(days=1)

    async def run(at: time) -> int:
        async with get_sessionmaker()() as session:
            return await reminders.run(session, datetime.combine(eve, at, tz))

    assert await run(time(17, 59)) == 0
    assert await run(time(18, 0)) == 1
    assert await run(time(21, 0)) == 0, "once per visit"
    await _drain()
    [reminder, _] = await _inbox(client, customer)
    assert (reminder["kind"], reminder["title"]) == ("booking.reminder", "Tu limpieza es mañana")
    assert reminder["body"] == "Ana llega a las 10:00."
    staff = (await _inbox(client, world["staff"]))[0]
    assert (staff["title"], staff["body"]) == ("Servicio mañana", "Tienes un servicio mañana a las 10:00.")


async def test_a_pending_transfer_reaches_admins_inbox_without_push(
    client: AsyncClient, admin, customer, world
) -> None:
    _, payment = await _spei_booking(client, customer, world)
    await _drain()
    [notice] = await _inbox(client, admin)
    assert (notice["kind"], notice["category"], notice["data"]) == (
        "payment.transfer_pending",
        "operations",
        {"payment_id": payment["id"]},
    )
    assert payment["provider_ref"] in notice["body"]
    assert await _outbox("push.send") == []
    assert await _inbox(client, customer) == []


async def test_old_notifications_are_pruned(client: AsyncClient, customer, world) -> None:
    await paid_booking(client, customer, world)
    await _drain()
    old = utcnow() - timedelta(days=get_settings().notification_retention_days + 1)
    async with get_sessionmaker()() as session, session.begin():
        await session.execute(
            update(Notification).where(Notification.kind == "booking.confirmed").values(created_at=old)
        )
    async with get_sessionmaker()() as session:
        await housekeeping.prune(session)
    assert await _inbox(client, customer) == []


async def test_subscription_notices_follow_its_life(client: AsyncClient, admin, customer, world) -> None:
    subscription, s = await _active(client, admin, customer, world)
    await _drain()
    assert await _run(s + timedelta(days=21)) == 1
    await _drain()
    cancel = await client.post(f"/subscriptions/{subscription['id']}/cancel", headers=customer)
    assert cancel.status_code == 200, cancel.text
    await _run(s + timedelta(days=28))
    await _drain()

    titles = [n["title"] for n in reversed(await _inbox(client, customer))]
    assert titles == [
        "Suscripción activa",
        "Tu suscripción se renueva pronto",
        "Suscripción cancelada",
        "Tu suscripción terminó",
    ]
    staff = [n["title"] for n in reversed(await _inbox(client, world["staff"]))]
    assert staff == ["Nuevo cliente recurrente", "Se liberó un horario"]


async def test_a_declined_card_and_a_missing_gps_capture(client: AsyncClient, admin, customer, world) -> None:
    booking = (await hold(client, customer, world, future_weekday(hour=15))).json()
    payment = (await client.post(f"/bookings/{booking['id']}/checkout", headers=customer)).json()
    await client.post(
        f"/payments/{payment['id']}/sandbox-outcome", headers=customer, json={"outcome": "failed"}
    )
    bid = await paid_booking(client, customer, world)
    failed = {"capture_status": "unavailable", "occurred_at": _at(5)}
    assert (
        await client.post(f"/bookings/{bid}/check-in", headers=world["staff"], json=failed)
    ).status_code == 201
    await _drain()

    declined = next(n for n in await _inbox(client, customer) if n["kind"] == "payment.failed")
    assert (declined["title"], declined["body"], declined["data"]) == (
        "No pudimos procesar tu pago",
        "Tu tarjeta fue rechazada.",
        {"booking_id": booking["id"]},
    )
    [exception] = await _inbox(client, admin)
    assert (exception["title"], exception["data"]) == ("Excepción de asistencia", {"booking_id": bid})
