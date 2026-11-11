"""Subscription renewal (owner decision 2026-11-11).

- On the paid cycle's last visit day the customer is told the renewal is charged on the next business day, and
  can cancel until then (`subscription.renewal_notice`).
- On that charge day the next cycle is created, held with its visits until the day before its first visit, and
  charged with the subscription's method: the card on file, or a SPEI transfer an agent confirms.
- Each later business day before that deadline: a failed card charge is retried, a pending transfer is
  reminded (`subscription.renewal_transfer_due`). Past the deadline the hold sweep ends the subscription as
  unpaid.
- A cancelled subscription ends the day after its last paid cycle.

Every step is idempotent, so the job can run often and in several processes: each subscription is advanced in
its own transaction under the cleaner's row lock and the subscription's (lock order: cleaner, subscription,
cycle, visits), and notices are keyed per cycle and day in the outbox."""

import logging
from datetime import date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import retry_on_lock_conflict
from app.core.timeutil import utcnow
from app.models import (
    Booking,
    BookingStatus,
    CycleStatus,
    Payment,
    PaymentMethod,
    PaymentStatus,
    StaffProfile,
    Subscription,
    SubscriptionCycle,
    SubscriptionEndReason,
    SubscriptionStatus,
)
from app.services import audit, outbox, payments
from app.services.commitments import clashes, local_instant
from app.services.recurrence import cycle_dates, cycle_end, is_business_day, renewal_dates
from app.services.scheduling import blocking_bookings, end_subscription

logger = logging.getLogger(__name__)


async def run(session: AsyncSession, today: date | None = None) -> int:
    """Advances every active subscription; returns how many steps were taken. `today` is the business date."""
    today = today or datetime.now(get_settings().business_tz).date()
    async with session.begin():
        active = list(
            await session.scalars(
                select(Subscription.id).where(Subscription.status == SubscriptionStatus.active)
            )
        )
    steps = 0
    for subscription_id in active:
        taken, charge = await _advance(session, subscription_id, today)
        if charge is not None:
            await payments.charge_saved_card(session, charge)
        steps += taken
    return steps


@retry_on_lock_conflict
async def _advance(session: AsyncSession, subscription_id: int, today: date) -> tuple[int, int | None]:
    """One subscription's due steps. Returns (steps taken, card payment to charge once committed)."""
    async with session.begin():
        staff_id = await session.scalar(
            select(Subscription.staff_id).where(Subscription.id == subscription_id)
        )
    async with session.begin():
        # The cleaner's lock before any plain read: under REPEATABLE READ the snapshot starts at the first
        # plain read, so it then includes the renewal (and its payment) a concurrent run committed meanwhile.
        await session.execute(select(StaffProfile.id).where(StaffProfile.id == staff_id).with_for_update())
        subscription = (
            await session.execute(
                select(Subscription).where(Subscription.id == subscription_id).with_for_update()
            )
        ).scalar_one()
        if subscription.status != SubscriptionStatus.active:
            return 0, None
        cycles = list(
            await session.scalars(
                select(SubscriptionCycle)
                .where(SubscriptionCycle.subscription_id == subscription.id)
                .order_by(SubscriptionCycle.sequence)
                .with_for_update()
            )
        )
        latest = cycles[-1]
        if subscription.cancelled_at is not None:
            paid_until = max(c.ends_on for c in cycles if c.status == CycleStatus.confirmed)
            if today <= paid_until:
                return 0, None
            end_subscription(session, subscription, SubscriptionEndReason.cancelled, utcnow())
            return 1, None
        if latest.status == CycleStatus.held:
            return await _chase_payment(session, subscription, latest, today)
        if latest.status != CycleStatus.confirmed:
            return 0, None
        notice_on, charge_on = renewal_dates(latest.starts_on, subscription.weekdays)
        steps = 0
        if today >= notice_on and await outbox.publish_once(
            session,
            "subscription.renewal_notice",
            latest.id,
            subscription_id=subscription.id,
            cycle_id=latest.id,
        ):
            steps += 1
        if today < charge_on:
            return steps, None
        opened, charge = await _open_renewal(session, subscription, latest, today)
        return steps + opened, charge


async def _open_renewal(
    session: AsyncSession, subscription: Subscription, paid: SubscriptionCycle, today: date
) -> tuple[int, int | None]:
    """Creates the next cycle from the subscription's own projection (the cleaner stayed blocked for it) and
    its payment."""
    starts_on = paid.ends_on + timedelta(days=1)
    dates = cycle_dates(starts_on, subscription.weekdays)
    duration = timedelta(minutes=subscription.visit_duration_minutes)
    starts = [local_instant(day, subscription.visit_start) for day in dates]
    visits = [(start, start + duration) for start in starts]
    existing = await blocking_bookings(
        session, subscription.staff_id, visits[0][0], visits[-1][1], exclude_subscription=subscription.id
    )
    taken = [start for start, end in visits if clashes(existing, start, end)]
    if taken:
        # Only data older than the blocking rule can get here; an admin must free the slot.
        logger.error("renewal of subscription %d blocked by bookings at %s", subscription.id, taken)
        await outbox.publish_once(
            session,
            "subscription.renewal_blocked",
            paid.id,
            subscription_id=subscription.id,
            cycle_id=paid.id,
        )
        return 0, None
    # Unpaid by the day before its first visit, the renewal lapses; charged on that very day, until its start.
    deadline = local_instant(dates[0], time()) if today < dates[0] else visits[0][0]
    cycle = SubscriptionCycle(
        subscription_id=subscription.id,
        sequence=paid.sequence + 1,
        starts_on=starts_on,
        ends_on=cycle_end(starts_on),
        status=CycleStatus.held,
        hold_expires_at=deadline,
        price_minor=subscription.price_minor,
        currency=subscription.currency,
    )
    session.add(cycle)
    await session.flush()
    session.add_all(
        Booking(
            customer_id=subscription.customer_id,
            staff_id=subscription.staff_id,
            subscription_cycle_id=cycle.id,
            starts_at=start,
            ends_at=end,
            status=BookingStatus.held,
            hold_expires_at=deadline,
            price_minor=0,
            staff_earning_minor=subscription.staff_earning_minor,
            currency=subscription.currency,
            address=subscription.address,
            address_id=subscription.address_id,
        )
        for start, end in visits
    )
    payment = await payments.pending_or_new(
        session,
        None,
        subscription.payment_method,
        amount_minor=cycle.price_minor,
        currency=cycle.currency,
        cycle_id=cycle.id,
    )
    audit.record(
        session, None, "subscription.renewal_opened", "subscription", subscription.id, cycle_id=cycle.id
    )
    if subscription.payment_method == PaymentMethod.spei:
        await _remind_transfer(session, subscription, cycle, payment, today)
        return 1, None
    payment.charge_on = today
    return 1, payment.id


async def _chase_payment(
    session: AsyncSession, subscription: Subscription, cycle: SubscriptionCycle, today: date
) -> tuple[int, int | None]:
    """A renewal awaiting payment, once per business day until its deadline: retry the card, or remind the
    transfer (a new reference if the agent rejected the last one)."""
    if not is_business_day(today) or cycle.hold_expires_at is None or cycle.hold_expires_at <= utcnow():
        return 0, None
    last = await session.scalar(
        select(Payment).where(Payment.subscription_cycle_id == cycle.id).order_by(Payment.id.desc()).limit(1)
    )
    method = subscription.payment_method
    if last is not None and last.status == PaymentStatus.pending and last.method != method:
        return 0, None
    if method == PaymentMethod.spei:
        payment = last if last is not None and last.status == PaymentStatus.pending else None
        payment = payment or await payments.pending_or_new(
            session, None, method, amount_minor=cycle.price_minor, currency=cycle.currency, cycle_id=cycle.id
        )
        return (1 if await _remind_transfer(session, subscription, cycle, payment, today) else 0), None
    if last is not None and last.charge_on == today:
        return 0, None
    payment = await payments.pending_or_new(
        session, None, method, amount_minor=cycle.price_minor, currency=cycle.currency, cycle_id=cycle.id
    )
    payment.charge_on = today
    return 1, payment.id


async def _remind_transfer(
    session: AsyncSession, subscription: Subscription, cycle: SubscriptionCycle, payment: Payment, today: date
) -> bool:
    return await outbox.publish_once(
        session,
        "subscription.renewal_transfer_due",
        cycle.id,
        day=today,
        subscription_id=subscription.id,
        cycle_id=cycle.id,
        payment_id=payment.id,
    )
