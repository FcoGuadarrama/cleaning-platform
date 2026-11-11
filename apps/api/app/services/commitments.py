"""What blocks a cleaner. Bookings block their interval (plus the travel buffer). Owner decision 2026-11-11:
a subscription also blocks its cleaner on its weekdays and visit time until it is deactivated, including the
cycles not created yet. Those future visits are projected from the subscription's pattern and checked like
bookings by everything that books the cleaner.

Projections grow only under the cleaner's row lock (contracting, renewal) and otherwise only shrink
(cancellation, expiry), so a check made under that lock stays valid until commit."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.timeutil import utcnow
from app.models import (
    Booking,
    BookingStatus,
    CycleStatus,
    Subscription,
    SubscriptionCycle,
    SubscriptionStatus,
)

BLOCKING = (BookingStatus.confirmed, BookingStatus.in_progress, BookingStatus.pending_review)


@dataclass(frozen=True)
class Busy:
    """A projected subscription visit: blocks like a booking, but no booking exists yet."""

    starts_at: datetime
    ends_at: datetime


type Span = Booking | Busy


def blocking_clause(now: datetime) -> object:
    return or_(
        Booking.status.in_(BLOCKING),
        and_(Booking.status == BookingStatus.held, Booking.hold_expires_at > now),
    )


def clashes(existing: Sequence[Span], start: datetime, end: datetime) -> bool:
    buffer = timedelta(minutes=get_settings().travel_buffer_minutes)
    return any(b.starts_at < end + buffer and b.ends_at > start - buffer for b in existing)


def local_instant(day: date, at: time) -> datetime:
    return datetime.combine(day, at, get_settings().business_tz).astimezone(UTC)


@dataclass(frozen=True)
class Pattern:
    """A subscription's weekly visits from `from_day` on, the first day no created cycle covers."""

    subscription_id: int | None
    weekdays: frozenset[int]
    visit_start: time
    duration: timedelta
    from_day: date

    def visit_on(self, day: date) -> Busy:
        start = local_instant(day, self.visit_start)
        return Busy(start, start + self.duration)

    def visits_between(self, start: datetime, end: datetime) -> list[Busy]:
        """Projected visits on the local days that [start, end) touches."""
        tz = get_settings().business_tz
        first = max(start.astimezone(tz).date(), self.from_day)
        last = end.astimezone(tz).date()
        days = (first + timedelta(days=i) for i in range((last - first).days + 1))
        return [self.visit_on(day) for day in days if day.weekday() in self.weekdays]

    def first_clash_with(self, other: Pattern) -> date | None:
        """Two patterns that clash on a shared weekday clash every week from the day both run."""
        day = max(self.from_day, other.from_day)
        for _ in range(7):
            if day.weekday() in self.weekdays & other.weekdays:
                mine = self.visit_on(day)
                if clashes([other.visit_on(day)], mine.starts_at, mine.ends_at):
                    return day
            day += timedelta(days=1)
        return None

    def clash_days(self, bookings: Sequence[Booking], others: Sequence[Pattern]) -> list[date]:
        """Days on which this pattern would clash with `bookings` or with `others` (a weekly clash with
        another pattern is reported by its first day)."""
        tz = get_settings().business_tz
        days = set()
        for b in bookings:
            day = b.starts_at.astimezone(tz).date()
            if day >= self.from_day and day.weekday() in self.weekdays:
                mine = self.visit_on(day)
                if clashes([b], mine.starts_at, mine.ends_at):
                    days.add(day)
        days.update(d for other in others if (d := self.first_clash_with(other)) is not None)
        return sorted(days)


async def patterns(session: AsyncSession, staff_id: int, *, exclude: int | None = None) -> list[Pattern]:
    """The cleaner's subscriptions that still block future weeks: held with a live hold, or active and not
    cancelled. A pattern starts the day after the subscription's latest live cycle."""
    now = utcnow()
    stmt = select(Subscription).where(
        Subscription.staff_id == staff_id,
        Subscription.status.in_([SubscriptionStatus.held, SubscriptionStatus.active]),
        Subscription.cancelled_at.is_(None),
    )
    if exclude is not None:
        stmt = stmt.where(Subscription.id != exclude)
    subscriptions = list(await session.scalars(stmt))
    if not subscriptions:
        return []
    live = or_(
        SubscriptionCycle.status == CycleStatus.confirmed,
        and_(SubscriptionCycle.status == CycleStatus.held, SubscriptionCycle.hold_expires_at > now),
    )
    rows = await session.execute(
        select(SubscriptionCycle.subscription_id, func.max(SubscriptionCycle.ends_on))
        .where(SubscriptionCycle.subscription_id.in_([s.id for s in subscriptions]), live)
        .group_by(SubscriptionCycle.subscription_id)
    )
    last_day = {subscription_id: day for subscription_id, day in rows}
    return [
        Pattern(
            subscription_id=s.id,
            weekdays=frozenset(s.weekdays),
            visit_start=s.visit_start,
            duration=timedelta(minutes=s.visit_duration_minutes),
            from_day=last_day[s.id] + timedelta(days=1),
        )
        for s in subscriptions
        if s.id in last_day
    ]


async def bookings_from(session: AsyncSession, staff_id: int, day: date) -> list[Booking]:
    """The cleaner's blocking bookings from `day` on, however far ahead."""
    since = local_instant(day, time()) - timedelta(minutes=get_settings().travel_buffer_minutes)
    return list(
        await session.scalars(
            select(Booking).where(
                Booking.staff_id == staff_id,
                blocking_clause(utcnow()),  # type: ignore[arg-type]
                Booking.ends_at > since,
            )
        )
    )
