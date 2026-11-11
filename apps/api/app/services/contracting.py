"""Contracting a subscription plan. Every visit of the first cycle must be free with the chosen cleaner; the
hold reserves all of them for the checkout TTL, and a successful payment confirms the cycle (see payments).
Visits are ordinary bookings, so attendance, earnings and settlements treat them like any other visit."""

from collections import defaultdict
from collections.abc import Sequence
from datetime import date, datetime, time, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import retry_on_lock_conflict
from app.core.errors import AppError, not_found
from app.core.timeutil import utcnow
from app.models import (
    Booking,
    BookingStatus,
    CycleStatus,
    Subscription,
    SubscriptionCycle,
    SubscriptionPlan,
    SubscriptionStatus,
    User,
)
from app.schemas import (
    AdminSubscriptionOut,
    BookingOut,
    SubscriptionCreateRequest,
    SubscriptionCycleOut,
    SubscriptionOut,
    SubscriptionScheduleOut,
)
from app.services import addresses, audit, commitments, idempotency
from app.services.commitments import Pattern, clashes, local_instant
from app.services.recurrence import cycle_dates, cycle_end
from app.services.scheduling import (
    blocking_bookings,
    day_window,
    expire_holds,
    free_starts,
    get_active_staff,
    validate_window,
)


async def _visible_plan(session: AsyncSession, plan_id: int) -> SubscriptionPlan:
    """A hidden or superseded version is reported as missing: customers can only contract what they see."""
    plan = await session.get(SubscriptionPlan, plan_id)
    if plan is None or not plan.is_active:
        raise not_found("Subscription plan")
    return plan


def _visit_dates(plan: SubscriptionPlan, weekdays: Sequence[int], starts_on: date) -> list[date]:
    settings = get_settings()
    if len(set(weekdays)) != len(weekdays) or len(weekdays) != plan.days_per_week:
        raise AppError(400, "weekdays_mismatch", f"Choose exactly {plan.days_per_week} different weekdays")
    if starts_on.weekday() not in weekdays:
        raise AppError(400, "start_not_on_weekday", "The first visit must fall on one of the chosen weekdays")
    today = datetime.now(settings.business_tz).date()
    if starts_on < today:
        raise AppError(400, "start_in_past", "The first visit must be today or later")
    if starts_on > today + timedelta(days=settings.subscription_start_window_days):
        raise AppError(400, "start_too_far", "The first visit is too far ahead")
    return cycle_dates(starts_on, list(weekdays))


def _pattern(weekdays: Sequence[int], visit_start: time, duration: timedelta, first_day: date) -> Pattern:
    """Visits after the first cycle; owner decision 2026-11-11: the cleaner stays blocked for them."""
    return Pattern(None, frozenset(weekdays), visit_start, duration, cycle_end(first_day) + timedelta(days=1))


async def _future_clash_days(session: AsyncSession, staff_id: int, pattern: Pattern) -> list[date]:
    return pattern.clash_days(
        await commitments.bookings_from(session, staff_id, pattern.from_day),
        await commitments.patterns(session, staff_id),
    )


async def schedule(
    session: AsyncSession, plan_id: int, staff_id: int, weekdays: Sequence[int], starts_on: date
) -> SubscriptionScheduleOut:
    plan = await _visible_plan(session, plan_id)
    await get_active_staff(session, staff_id)
    dates = _visit_dates(plan, weekdays, starts_on)
    duration = timedelta(minutes=plan.visit_duration_minutes)
    existing = await blocking_bookings(session, staff_id, day_window(dates[0])[0], day_window(dates[-1])[1])
    now = utcnow()
    tz = get_settings().business_tz
    free_each_day = [
        {start.astimezone(tz).time() for start in free_starts(existing, day, duration, now)} for day in dates
    ]
    after_first_cycle = cycle_end(dates[0]) + timedelta(days=1)
    later_bookings = await commitments.bookings_from(session, staff_id, after_first_cycle)
    others = await commitments.patterns(session, staff_id)
    free_later = {
        t
        for t in set.intersection(*free_each_day)
        if not _pattern(weekdays, t, duration, dates[0]).clash_days(later_bookings, others)
    }
    return SubscriptionScheduleOut(
        plan_id=plan.id,
        staff_id=staff_id,
        timezone=str(tz),
        starts_on=dates[0],
        ends_on=cycle_end(dates[0]),
        renews_on=cycle_end(dates[0]) + timedelta(days=1),
        visit_dates=dates,
        start_times=sorted(free_later),
    )


@retry_on_lock_conflict
async def create_hold(
    session: AsyncSession, customer: User, body: SubscriptionCreateRequest, idempotency_key: str | None = None
) -> int:
    """One transaction under the cleaner's row lock (same order as single bookings): check every visit, then
    insert the subscription with a copy of the plan, its first cycle and one held booking per visit."""
    settings = get_settings()
    async with session.begin():
        key = (
            await idempotency.claim(session, customer, idempotency_key, "subscription", body)
            if idempotency_key
            else None
        )
        if key is not None and key.resource_id is not None:
            return key.resource_id
        await get_active_staff(session, body.staff_id, lock=True)
        plan = await _visible_plan(session, body.plan_id)
        address = await addresses.get_owned(session, customer, body.address_id)
        dates = _visit_dates(plan, body.weekdays, body.starts_on)
        duration = timedelta(minutes=plan.visit_duration_minutes)
        visits = [
            (local_instant(day, body.visit_start), local_instant(day, body.visit_start) + duration)
            for day in dates
        ]
        for start, end in visits:
            validate_window(start, end)
        existing = await blocking_bookings(session, body.staff_id, visits[0][0], visits[-1][1], lock=True)
        taken = [
            start.astimezone(settings.business_tz).date()
            for start, end in visits
            if clashes(existing, start, end)
        ] + await _future_clash_days(
            session, body.staff_id, _pattern(body.weekdays, body.visit_start, duration, dates[0])
        )
        if taken:
            raise AppError(
                409,
                "visits_unavailable",
                "Some visits are no longer available at that time",
                details={"dates": [d.isoformat() for d in taken]},
            )
        now = utcnow()
        expires = now + timedelta(minutes=settings.hold_ttl_minutes)
        subscription = Subscription(
            customer_id=customer.id,
            staff_id=body.staff_id,
            plan_id=plan.id,
            status=SubscriptionStatus.held,
            weekdays=list(body.weekdays),
            visit_start=body.visit_start,
            address=address.one_line(),
            address_id=address.id,
            plan_name=plan.name,
            days_per_week=plan.days_per_week,
            visits_per_cycle=plan.visits_per_cycle,
            visit_duration_minutes=plan.visit_duration_minutes,
            price_minor=plan.price_minor,
            staff_earning_minor=plan.staff_earning_minor,
            currency=plan.currency,
            terms=plan.terms,
            terms_accepted_at=now,
        )
        session.add(subscription)
        await session.flush()
        cycle = SubscriptionCycle(
            subscription_id=subscription.id,
            sequence=1,
            starts_on=dates[0],
            ends_on=cycle_end(dates[0]),
            status=CycleStatus.held,
            hold_expires_at=expires,
            price_minor=plan.price_minor,
            currency=plan.currency,
        )
        session.add(cycle)
        await session.flush()
        session.add_all(
            Booking(
                customer_id=customer.id,
                staff_id=body.staff_id,
                subscription_cycle_id=cycle.id,
                starts_at=start,
                ends_at=end,
                status=BookingStatus.held,
                hold_expires_at=expires,
                price_minor=0,
                staff_earning_minor=plan.staff_earning_minor,
                currency=plan.currency,
                address=address.one_line(),
                address_id=address.id,
            )
            for start, end in visits
        )
        audit.record(
            session,
            customer.id,
            "subscription.hold_created",
            "subscription",
            subscription.id,
            plan_id=plan.id,
            cycle_id=cycle.id,
            visits=len(visits),
        )
        if key is not None:
            key.resource_id = subscription.id
    return subscription.id


def _columns(row: Subscription | SubscriptionCycle) -> dict[str, Any]:
    return {column.key: getattr(row, column.key) for column in type(row).__table__.columns}


async def _present[S: SubscriptionOut](
    session: AsyncSession, subscriptions: Sequence[Subscription], model: type[S]
) -> list[S]:
    ids = [s.id for s in subscriptions]
    cycles = (
        await session.scalars(
            select(SubscriptionCycle)
            .where(SubscriptionCycle.subscription_id.in_(ids))
            .order_by(SubscriptionCycle.sequence)
        )
    ).all()
    visits = (
        await session.scalars(
            select(Booking)
            .where(Booking.subscription_cycle_id.in_([c.id for c in cycles]))
            .order_by(Booking.starts_at)
        )
    ).all()
    visits_by_cycle: dict[int, list[BookingOut]] = defaultdict(list)
    for v in visits:
        assert v.subscription_cycle_id is not None
        visits_by_cycle[v.subscription_cycle_id].append(BookingOut.model_validate(v))
    cycles_by_subscription: dict[int, list[SubscriptionCycleOut]] = defaultdict(list)
    for c in cycles:
        cycles_by_subscription[c.subscription_id].append(
            SubscriptionCycleOut.model_validate({**_columns(c), "visits": visits_by_cycle[c.id]})
        )
    out = []
    for s in subscriptions:
        own = cycles_by_subscription[s.id]
        paid = [c for c in own if c.status == CycleStatus.confirmed]
        active = s.status == SubscriptionStatus.active and paid
        renews_on = paid[-1].ends_on + timedelta(days=1) if active else None
        out.append(model.model_validate({**_columns(s), "cycles": own, "renews_on": renews_on}))
    return out


async def list_for_customer(session: AsyncSession, customer: User) -> list[SubscriptionOut]:
    """Pending and active subscriptions; a lapsed hold is left out."""
    await expire_holds(session)
    async with session.begin():
        rows = (
            await session.scalars(
                select(Subscription)
                .where(
                    Subscription.customer_id == customer.id,
                    Subscription.status != SubscriptionStatus.expired,
                )
                .order_by(Subscription.id.desc())
            )
        ).all()
        return await _present(session, rows, SubscriptionOut)


async def get_for_customer(session: AsyncSession, customer: User, subscription_id: int) -> SubscriptionOut:
    """Another customer's subscription is reported as missing, never as forbidden."""
    await expire_holds(session)
    async with session.begin():
        row = await session.scalar(
            select(Subscription).where(
                Subscription.id == subscription_id, Subscription.customer_id == customer.id
            )
        )
        if row is None:
            raise not_found("Subscription")
        return (await _present(session, [row], SubscriptionOut))[0]


async def list_all(session: AsyncSession) -> list[AdminSubscriptionOut]:
    """Every subscription, newest first, lapsed holds included."""
    await expire_holds(session)
    async with session.begin():
        rows = (await session.scalars(select(Subscription).order_by(Subscription.id.desc()))).all()
        return await _present(session, rows, AdminSubscriptionOut)


async def get_any(session: AsyncSession, subscription_id: int) -> AdminSubscriptionOut:
    await expire_holds(session)
    async with session.begin():
        row = await session.get(Subscription, subscription_id)
        if row is None:
            raise not_found("Subscription")
        return (await _present(session, [row], AdminSubscriptionOut))[0]
