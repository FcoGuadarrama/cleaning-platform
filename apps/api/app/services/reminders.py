"""Day-before visit reminders (owner decision 2026-11-13). From `VISIT_REMINDER_LOCAL_TIME` in the business
time zone, every confirmed visit of the next local day gets one `booking.reminder` event; the outbox key makes
later runs no-ops."""

from datetime import datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.timeutil import utcnow
from app.models import Booking, BookingStatus
from app.services import outbox


async def run(session: AsyncSession, now: datetime | None = None) -> int:
    """Returns how many reminders were queued."""
    settings = get_settings()
    local = (now or utcnow()).astimezone(settings.business_tz)
    if local.time() < settings.visit_reminder_local_time:
        return 0
    starts = datetime.combine(local.date() + timedelta(days=1), time(0), settings.business_tz)
    queued = 0
    async with session.begin():
        visits = await session.scalars(
            select(Booking.id).where(
                Booking.status == BookingStatus.confirmed,
                Booking.starts_at >= starts,
                Booking.starts_at < starts + timedelta(days=1),
            )
        )
        for booking_id in list(visits):
            if await outbox.publish_once(session, "booking.reminder", booking_id, booking_id=booking_id):
                queued += 1
    return queued
