"""Availability and reservation logic. Authoritative overlap check happens under a staff row lock."""

from collections.abc import Sequence
from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import Select, and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import retry_on_lock_conflict
from app.core.errors import AppError, conflict, forbidden, not_found
from app.core.timeutil import utcnow
from app.models import (
    Booking,
    BookingStatus,
    CycleStatus,
    Payment,
    PaymentStatus,
    Role,
    ServiceOffering,
    StaffProfile,
    Subscription,
    SubscriptionCycle,
    SubscriptionStatus,
    User,
)
from app.schemas import BookingCreateRequest
from app.services import addresses, audit, idempotency, outbox

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


def day_window(day: date) -> tuple[datetime, datetime]:
    """Opening and closing time of a working day, in the business time zone."""
    settings = get_settings()
    tz = settings.business_tz
    return (
        datetime.combine(day, time(settings.workday_start_hour), tz),
        datetime.combine(day, time(settings.workday_end_hour), tz),
    )


def clashes(existing: Sequence[Booking], start: datetime, end: datetime) -> bool:
    buffer = timedelta(minutes=get_settings().travel_buffer_minutes)
    return any(b.starts_at < end + buffer and b.ends_at > start - buffer for b in existing)


def free_starts(existing: Sequence[Booking], day: date, duration: timedelta, now: datetime) -> list[datetime]:
    """Future start times (UTC) on `day` where a visit of `duration` clashes with none of `existing`."""
    if not is_business_day(day):
        return []
    day_start, day_end = day_window(day)
    step = timedelta(minutes=get_settings().slot_step_minutes)
    starts: list[datetime] = []
    cursor = day_start
    while cursor + duration <= day_end:
        if cursor > now and not clashes(existing, cursor, cursor + duration):
            starts.append(cursor.astimezone(UTC))
        cursor += step
    return starts


async def blocking_bookings(
    session: AsyncSession, staff_id: int, start: datetime, end: datetime, *, lock: bool = False
) -> Sequence[Booking]:
    """The staff member's bookings that block any visit inside [start, end), travel buffer included."""
    stmt = _overlapping(staff_id, start, end, utcnow()).order_by(Booking.starts_at)
    if lock:
        stmt = stmt.with_for_update()
    return (await session.execute(stmt)).scalars().all()


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
    await get_active_staff(session, staff_id)
    offering = await get_active_offering(session, offering_id)
    if not is_business_day(day):
        return []
    existing = await blocking_bookings(session, staff_id, *day_window(day))
    duration = timedelta(minutes=offering.duration_minutes)
    return [(start, start + duration) for start in free_starts(existing, day, duration, utcnow())]


def validate_window(start: datetime, end: datetime) -> None:
    local_start = start.astimezone(get_settings().business_tz)
    if start <= utcnow():
        raise AppError(400, "start_in_past", "Start time must be in the future")
    if not is_business_day(local_start.date()):
        raise AppError(400, "not_business_day", "Services run Monday to Friday")
    opens, closes = day_window(local_start.date())
    if start < opens or end > closes:
        raise AppError(400, "outside_working_hours", "Outside working hours")


@retry_on_lock_conflict
async def create_hold(
    session: AsyncSession, customer: User, body: BookingCreateRequest, idempotency_key: str | None = None
) -> Booking:
    """Single transaction: claim the idempotency key → lock staff row → check overlaps → insert hold."""
    staff_id = body.staff_id
    async with session.begin():
        key = (
            await idempotency.claim(session, customer, idempotency_key, "booking", body)
            if idempotency_key
            else None
        )
        if key is not None and key.resource_id is not None:
            replayed = await session.get(Booking, key.resource_id)
            assert replayed is not None
            return replayed
        # Lock before any plain read: under REPEATABLE READ the snapshot starts at the first plain read, so it
        # then includes every booking committed by the transaction that held the lock before us.
        await get_active_staff(session, staff_id, lock=True)
        offering = await get_active_offering(session, body.offering_id)
        address = await addresses.get_owned(session, customer, body.address_id)
        start = body.starts_at.astimezone(UTC)
        end = start + timedelta(minutes=offering.duration_minutes)
        validate_window(start, end)
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
        if key is not None:
            key.resource_id = booking.id
        audit.record(session, customer.id, "booking.hold_created", "booking", booking.id)
    return booking


@retry_on_lock_conflict
async def expire_holds(session: AsyncSession) -> int:
    """Releases lapsed holds: single-visit bookings, subscription visits, their cycle and, for a first
    cycle, the subscription itself. Returns the number of bookings released.

    Runs from the background sweeper and before every read that reports hold status, so it must stay cheap
    and out of the way of writers: candidates come from a plain read (no locks when nothing has lapsed), then
    are locked by primary key with SKIP LOCKED. A row another transaction holds, such as a payment
    confirming it, is left for the next sweep instead of waited on; with no range scan under a lock, no gap
    is locked against new holds either. Rows are re-checked as `held` once locked, so a payment confirmed
    meanwhile is never undone."""
    async with session.begin():
        now = utcnow()
        # Cycles before their visits, the lock order of payments._confirm_cycle.
        lapsed_cycles = set(
            await session.scalars(
                select(SubscriptionCycle.id).where(
                    SubscriptionCycle.status == CycleStatus.held, SubscriptionCycle.hold_expires_at <= now
                )
            )
        )
        cycles = await _lock_free(
            session,
            select(SubscriptionCycle).where(
                SubscriptionCycle.id.in_(lapsed_cycles),
                SubscriptionCycle.status == CycleStatus.held,
                SubscriptionCycle.hold_expires_at <= now,
            ),
        )
        # The visits of a cycle someone else holds stay with that cycle: confirming it confirms them too.
        busy_cycles = lapsed_cycles - {c.id for c in cycles}
        lapsed_bookings = [
            b.id
            for b in await session.execute(
                select(Booking.id, Booking.subscription_cycle_id).where(
                    Booking.status == BookingStatus.held, Booking.hold_expires_at <= now
                )
            )
            if b.subscription_cycle_id not in busy_cycles
        ]
        bookings = await _lock_free(
            session,
            select(Booking).where(
                Booking.id.in_(lapsed_bookings),
                Booking.status == BookingStatus.held,
                Booking.hold_expires_at <= now,
            ),
        )
        for booking in bookings:
            booking.status = BookingStatus.expired
        for cycle in cycles:
            cycle.status = CycleStatus.expired
        if cycles:
            await session.execute(
                update(Subscription)
                .where(
                    Subscription.id.in_([c.subscription_id for c in cycles]),
                    Subscription.status == SubscriptionStatus.held,
                )
                .values(status=SubscriptionStatus.expired)
            )
    return len(bookings)


async def _lock_free[M: (Booking, SubscriptionCycle)](session: AsyncSession, stmt: Select[M]) -> list[M]:
    """The rows of `stmt` no other transaction holds, locked for this one."""
    return list(await session.scalars(stmt.with_for_update(skip_locked=True)))


CANCELLABLE = (BookingStatus.held, BookingStatus.confirmed)


@retry_on_lock_conflict
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
        outbox.publish(session, "booking.cancelled", booking.id, booking_id=booking.id)
    return booking, bool(paid)


async def staff_profile_for(session: AsyncSession, user: User) -> StaffProfile:
    profile = (
        await session.execute(select(StaffProfile).where(StaffProfile.user_id == user.id))
    ).scalar_one_or_none()
    if profile is None:
        raise forbidden()
    return profile


def visible_bookings_stmt(user: User, staff: StaffProfile | None) -> Select[Booking]:
    """A lapsed subscription hold is listed only under its subscription; customers also see a pending one
    there instead of as a pile of unpaid visits."""
    stmt = select(Booking).order_by(Booking.starts_at)
    hidden = (
        [BookingStatus.expired] if user.role == Role.admin else [BookingStatus.expired, BookingStatus.held]
    )
    stmt = stmt.where(or_(Booking.subscription_cycle_id.is_(None), Booking.status.not_in(hidden)))
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
