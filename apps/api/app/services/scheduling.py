"""Availability and reservation logic. Authoritative overlap check happens under a staff row lock."""

from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import Select, and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError, conflict, forbidden, not_found
from app.core.timeutil import utcnow
from app.models import (
    Booking,
    BookingStatus,
    Payment,
    PaymentStatus,
    Role,
    ServiceOffering,
    StaffProfile,
    User,
)
from app.services import addresses, audit

BLOCKING = (BookingStatus.confirmed, BookingStatus.in_progress, BookingStatus.pending_review)


def _blocking_clause(now: datetime) -> object:
    return or_(
        Booking.status.in_(BLOCKING),
        and_(Booking.status == BookingStatus.held, Booking.hold_expires_at > now),
    )


def _overlapping(staff_id: int, start: datetime, end: datetime, now: datetime) -> Select[Booking]:
    buffer = timedelta(minutes=get_settings().travel_buffer_minutes)
    return select(Booking).where(
        Booking.staff_id == staff_id,
        _blocking_clause(now),  # type: ignore[arg-type]
        Booking.starts_at < end + buffer,
        Booking.ends_at > start - buffer,
    )


def is_business_day(day: date) -> bool:
    return day.weekday() < 5


async def get_active_staff(session: AsyncSession, staff_id: int, *, lock: bool = False) -> StaffProfile:
    stmt = select(StaffProfile).where(StaffProfile.id == staff_id, StaffProfile.is_active.is_(True))
    if lock:
        stmt = stmt.with_for_update()
    staff = (await session.execute(stmt)).scalar_one_or_none()
    if staff is None:
        raise not_found("Staff")
    return staff


async def get_active_offering(session: AsyncSession, offering_id: int) -> ServiceOffering:
    offering = await session.get(ServiceOffering, offering_id)
    if offering is None or not offering.is_active:
        raise not_found("Offering")
    return offering


async def availability(
    session: AsyncSession, staff_id: int, offering_id: int, day: date
) -> list[tuple[datetime, datetime]]:
    settings = get_settings()
    await get_active_staff(session, staff_id)
    offering = await get_active_offering(session, offering_id)
    if not is_business_day(day):
        return []
    tz = settings.business_tz
    day_start = datetime.combine(day, time(settings.workday_start_hour), tz)
    day_end = datetime.combine(day, time(settings.workday_end_hour), tz)
    now = utcnow()
    existing = (
        (await session.execute(_overlapping(staff_id, day_start, day_end, now).order_by(Booking.starts_at)))
        .scalars()
        .all()
    )
    buffer = timedelta(minutes=settings.travel_buffer_minutes)
    duration = timedelta(minutes=offering.duration_minutes)
    step = timedelta(minutes=settings.slot_step_minutes)
    slots: list[tuple[datetime, datetime]] = []
    cursor = day_start
    while cursor + duration <= day_end:
        end = cursor + duration
        clash = any(b.starts_at < end + buffer and b.ends_at > cursor - buffer for b in existing)
        if cursor > now and not clash:
            slots.append((cursor.astimezone(UTC), end.astimezone(UTC)))
        cursor += step
    return slots


def _validate_window(start: datetime, end: datetime) -> None:
    settings = get_settings()
    local_start = start.astimezone(settings.business_tz)
    local_end = end.astimezone(settings.business_tz)
    if start <= utcnow():
        raise AppError(400, "start_in_past", "Start time must be in the future")
    if not is_business_day(local_start.date()):
        raise AppError(400, "not_business_day", "Services run Monday to Friday")
    opens = datetime.combine(local_start.date(), time(settings.workday_start_hour), settings.business_tz)
    closes = datetime.combine(local_start.date(), time(settings.workday_end_hour), settings.business_tz)
    if local_start < opens or local_end > closes:
        raise AppError(400, "outside_working_hours", "Outside working hours")


async def create_hold(
    session: AsyncSession, customer: User, staff_id: int, offering_id: int, start: datetime, address_id: int
) -> Booking:
    """Single transaction: lock staff row → check overlaps → insert hold."""
    async with session.begin():
        # Lock first: under REPEATABLE READ the snapshot starts at the first read, and only
        # locking reads see rows committed by the transaction that held the lock before us.
        await get_active_staff(session, staff_id, lock=True)
        offering = await get_active_offering(session, offering_id)
        address = await addresses.get_owned(session, customer, address_id)
        start = start.astimezone(UTC)
        end = start + timedelta(minutes=offering.duration_minutes)
        _validate_window(start, end)
        now = utcnow()
        overlap = _overlapping(staff_id, start, end, now).limit(1).with_for_update()
        clash = (await session.execute(overlap)).first()
        if clash is not None:
            raise conflict("slot_unavailable", "The selected time is no longer available")
        booking = Booking(
            customer_id=customer.id,
            staff_id=staff_id,
            offering_id=offering.id,
            starts_at=start,
            ends_at=end,
            status=BookingStatus.held,
            hold_expires_at=now + timedelta(minutes=get_settings().hold_ttl_minutes),
            price_minor=offering.price_minor,
            staff_earning_minor=offering.staff_earning_minor,
            currency=offering.currency,
            address=address.one_line(),
            address_id=address.id,
        )
        session.add(booking)
        await session.flush()
        audit.record(session, customer.id, "booking.hold_created", "booking", booking.id)
    return booking


async def expire_holds(session: AsyncSession) -> int:
    async with session.begin():
        result = await session.execute(
            update(Booking)
            .where(Booking.status == BookingStatus.held, Booking.hold_expires_at <= utcnow())
            .values(status=BookingStatus.expired)
        )
    return int(getattr(result, "rowcount", 0))


CANCELLABLE = (BookingStatus.held, BookingStatus.confirmed)


async def cancel(session: AsyncSession, admin: User, booking_id: int, reason: str) -> tuple[Booking, bool]:
    """Admin cancel of a held/confirmed booking. A captured payment is only flagged for refund here:
    refund execution and late-cancellation compensation are open product decisions."""
    async with session.begin():
        # Same lock order as the payment webhook (payments, then booking) so the two cannot deadlock.
        payments = (
            (await session.execute(select(Payment).where(Payment.booking_id == booking_id).with_for_update()))
            .scalars()
            .all()
        )
        booking = (
            await session.execute(select(Booking).where(Booking.id == booking_id).with_for_update())
        ).scalar_one_or_none()
        if booking is None:
            raise not_found("Booking")
        if booking.status not in CANCELLABLE:
            raise conflict("invalid_booking_state", f"Cannot cancel a booking in {booking.status}")
        paid = [p for p in payments if p.status == PaymentStatus.succeeded]
        for payment in paid:
            payment.needs_refund = True
        previous = booking.status
        booking.status = BookingStatus.cancelled
        booking.hold_expires_at = None
        audit.record(
            session,
            admin.id,
            "booking.cancelled",
            "booking",
            booking.id,
            reason=reason,
            previous_status=previous.value,
            refund_payment_ids=[p.id for p in paid],
        )
    return booking, bool(paid)


async def staff_profile_for(session: AsyncSession, user: User) -> StaffProfile:
    profile = (
        await session.execute(select(StaffProfile).where(StaffProfile.user_id == user.id))
    ).scalar_one_or_none()
    if profile is None:
        raise forbidden()
    return profile


def visible_bookings_stmt(user: User, staff: StaffProfile | None) -> Select[Booking]:
    stmt = select(Booking).order_by(Booking.starts_at)
    if user.role == Role.customer:
        return stmt.where(Booking.customer_id == user.id)
    if user.role == Role.staff:
        assert staff is not None
        return stmt.where(Booking.staff_id == staff.id, Booking.status != BookingStatus.held)
    return stmt


async def get_visible_booking(
    session: AsyncSession, user: User, booking_id: int, *, lock: bool = False
) -> Booking:
    staff = await staff_profile_for(session, user) if user.role == Role.staff else None
    stmt = visible_bookings_stmt(user, staff).where(Booking.id == booking_id)
    if lock:
        stmt = stmt.with_for_update()
    booking = (await session.execute(stmt)).scalar_one_or_none()
    if booking is None:
        raise not_found("Booking")
    return booking
