"""Push delivery of one inbox notification to its recipient's devices through the Expo Push Service.

Called by the outbox for `push.send` messages, so a failure is retried with backoff and ends `dead`. Tickets
with `DeviceNotRegistered` disable their device; any other ticket error fails the delivery. Delivery is at
least once: after a partial failure the retry can repeat the push on devices that already got it."""

import logging
from collections.abc import Awaitable, Callable, Sequence
from typing import Any

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.timeutil import utcnow
from app.models import Notification, NotificationPreference, PushDevice

logger = logging.getLogger(__name__)

EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send"
# Expo accepts at most 100 messages per request; registration keeps far fewer devices per user.
MAX_DEVICES_PER_USER = 10
ANDROID_CHANNEL = "default"

Ticket = dict[str, Any]
Provider = Callable[[list[dict[str, Any]]], Awaitable[list[Ticket]]]

# Tests swap in an httpx.MockTransport; None uses the network.
transport: httpx.AsyncBaseTransport | None = None


class PushError(Exception):
    pass


async def send(session: AsyncSession, notification_id: int) -> None:
    async with session.begin():
        notification = await session.get(Notification, notification_id)
        if notification is None or not await push_enabled(session, notification):
            return
        devices = list(
            await session.scalars(
                select(PushDevice)
                .where(PushDevice.user_id == notification.user_id, PushDevice.disabled_at.is_(None))
                .order_by(PushDevice.id)
            )
        )
    if not devices:
        return
    data = {**notification.data, "notification_id": notification.id}
    messages = [
        {
            "to": device.token,
            "title": notification.title,
            "body": notification.body,
            "data": data,
            "sound": "default",
            "channelId": ANDROID_CHANNEL,
        }
        for device in devices
    ]
    tickets = await _PROVIDERS[get_settings().push_provider](messages)
    await _apply_tickets(session, devices, tickets)


async def push_enabled(session: AsyncSession, notification: Notification) -> bool:
    preference = await session.get(NotificationPreference, (notification.user_id, notification.category))
    return preference is None or preference.push_enabled


async def _apply_tickets(session: AsyncSession, devices: Sequence[PushDevice], tickets: list[Ticket]) -> None:
    if len(tickets) != len(devices):
        raise PushError(f"expected {len(devices)} tickets, got {len(tickets)}")
    gone = [d.id for d, t in zip(devices, tickets, strict=True) if _error(t) == "DeviceNotRegistered"]
    if gone:
        async with session.begin():
            await session.execute(
                update(PushDevice).where(PushDevice.id.in_(gone)).values(disabled_at=utcnow())
            )
    failed = [t for t in tickets if t.get("status") != "ok" and _error(t) != "DeviceNotRegistered"]
    if failed:
        detail = str(failed[0].get("message", ""))[:300]
        raise PushError(f"{len(failed)} of {len(tickets)} pushes failed: {detail}")


def _error(ticket: Ticket) -> str | None:
    details = ticket.get("details")
    return details.get("error") if isinstance(details, dict) else None


async def _log_provider(messages: list[dict[str, Any]]) -> list[Ticket]:
    """Local and test environments: no token or text leaves the process, only counts are logged."""
    logger.info("push: %d message(s)", len(messages))
    return [{"status": "ok"} for _ in messages]


async def _expo_provider(messages: list[dict[str, Any]]) -> list[Ticket]:
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    token = get_settings().expo_access_token
    if token:
        headers["Authorization"] = f"Bearer {token}"
    async with httpx.AsyncClient(transport=transport, timeout=20) as client:
        response = await client.post(EXPO_SEND_URL, json=messages, headers=headers)
    response.raise_for_status()
    tickets = response.json().get("data")
    if not isinstance(tickets, list):
        raise PushError(f"unexpected Expo response: {response.text[:200]}")
    return tickets


_PROVIDERS: dict[str, Provider] = {"log": _log_provider, "expo": _expo_provider}
