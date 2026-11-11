import json
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import insert_unless_duplicate, retry_on_lock_conflict
from app.core.errors import AppError, conflict, not_found
from app.core.security import verify_signature
from app.core.timeutil import utcnow
from app.models import (
    Booking,
    BookingStatus,
    CycleStatus,
    Payment,
    PaymentStatus,
    Subscription,
    SubscriptionCycle,
    SubscriptionStatus,
    User,
    WebhookEvent,
)
from app.payments import sandbox
from app.services import audit
from app.services.scheduling import get_visible_booking


async def _pending_or_new(
    session: AsyncSession,
    customer: User,
    *,
    amount_minor: int,
    currency: str,
    booking_id: int | None = None,
    cycle_id: int | None = None,
) -> Payment:
    """Reuses the pending attempt for the same target, so retrying checkout never opens a second charge."""
    target = Payment.booking_id == booking_id if booking_id else Payment.subscription_cycle_id == cycle_id
    pending = await session.scalar(select(Payment).where(target, Payment.status == PaymentStatus.pending))
    if pending is not None:
        return pending
    payment = Payment(
        booking_id=booking_id,
        subscription_cycle_id=cycle_id,
        provider=sandbox.PROVIDER,
        provider_ref=sandbox.new_reference(),
        status=PaymentStatus.pending,
        amount_minor=amount_minor,
        currency=currency,
    )
    session.add(payment)
    await session.flush()
    audit.record(session, customer.id, "payment.checkout_started", "payment", payment.id)
    return payment


@retry_on_lock_conflict
async def start_checkout(session: AsyncSession, customer: User, booking_id: int) -> Payment:
    async with session.begin():
        booking = await get_visible_booking(session, customer, booking_id, lock=True)
        if booking.status != BookingStatus.held or booking.hold_expires_at is None:
            raise conflict("booking_not_payable", "Booking is not awaiting payment")
        if booking.hold_expires_at <= utcnow():
            raise conflict("hold_expired", "The reservation hold expired")
        return await _pending_or_new(
            session,
            customer,
            amount_minor=booking.price_minor,
            currency=booking.currency,
            booking_id=booking.id,
        )


async def _owned_subscription(
    session: AsyncSession, customer: User, subscription_id: int, *, lock: bool = False
) -> Subscription:
    stmt = select(Subscription).where(
        Subscription.id == subscription_id, Subscription.customer_id == customer.id
    )
    if lock:
        stmt = stmt.with_for_update()
    subscription = await session.scalar(stmt)
    if subscription is None:
        raise not_found("Subscription")
    return subscription


@retry_on_lock_conflict
async def start_subscription_checkout(session: AsyncSession, customer: User, subscription_id: int) -> Payment:
    """Charges the subscription's held cycle (the first one, while contracting)."""
    async with session.begin():
        subscription = await _owned_subscription(session, customer, subscription_id)
        cycle = await session.scalar(
            select(SubscriptionCycle)
            .where(
                SubscriptionCycle.subscription_id == subscription.id,
                SubscriptionCycle.status == CycleStatus.held,
            )
            .with_for_update()
        )
        if cycle is None or cycle.hold_expires_at is None:
            raise conflict("subscription_not_payable", "Nothing is awaiting payment")
        if cycle.hold_expires_at <= utcnow():
            raise conflict("hold_expired", "The reservation hold expired")
        return await _pending_or_new(
            session, customer, amount_minor=cycle.price_minor, currency=cycle.currency, cycle_id=cycle.id
        )


@retry_on_lock_conflict
async def handle_sandbox_webhook(session: AsyncSession, body: bytes, signature: str) -> bool:
    """Returns True when the event was a replay. Signature is verified before parsing. Only the event-id
    insert can mean "replay": any other failure rolls the whole event back, so a redelivery applies it."""
    if not verify_signature(body, signature, get_settings().sandbox_webhook_secret):
        raise AppError(400, "invalid_signature", "Invalid webhook signature")
    event: dict[str, Any] = json.loads(body)
    async with session.begin():
        received = WebhookEvent(provider=sandbox.PROVIDER, event_id=str(event["id"]), payload=event)
        if not await insert_unless_duplicate(session, received):
            return True
        await _apply_event(session, event)
    return False


async def _apply_event(session: AsyncSession, event: dict[str, Any]) -> None:
    payment = (
        await session.execute(
            select(Payment).where(Payment.provider_ref == event["data"]["reference"]).with_for_update()
        )
    ).scalar_one_or_none()
    if payment is None:
        raise AppError(400, "unknown_payment", "Unknown payment reference")
    if payment.status != PaymentStatus.pending:
        return
    if event["type"] == "payment.failed":
        payment.status = PaymentStatus.failed
        audit.record(session, None, "payment.failed", "payment", payment.id)
        return
    payment.status = PaymentStatus.succeeded
    confirmed = await (
        _confirm_booking(session, payment) if payment.booking_id else _confirm_cycle(session, payment)
    )
    if not confirmed:
        payment.needs_refund = True
        audit.record(session, None, "payment.late_success_needs_refund", "payment", payment.id)


def _hold_valid(status: object, held: object, expires_at: datetime | None) -> bool:
    return status == held and expires_at is not None and expires_at > utcnow()


async def _confirm_booking(session: AsyncSession, payment: Payment) -> bool:
    booking = (
        await session.execute(select(Booking).where(Booking.id == payment.booking_id).with_for_update())
    ).scalar_one()
    if not _hold_valid(booking.status, BookingStatus.held, booking.hold_expires_at):
        return False
    booking.status = BookingStatus.confirmed
    booking.hold_expires_at = None
    audit.record(session, None, "booking.confirmed", "booking", booking.id, payment_id=payment.id)
    return True


async def _confirm_cycle(session: AsyncSession, payment: Payment) -> bool:
    """Lock order: payment, cycle, its visits, subscription. Confirms every visit of the cycle at once."""
    cycle = (
        await session.execute(
            select(SubscriptionCycle)
            .where(SubscriptionCycle.id == payment.subscription_cycle_id)
            .with_for_update()
        )
    ).scalar_one()
    if not _hold_valid(cycle.status, CycleStatus.held, cycle.hold_expires_at):
        return False
    visits = (
        await session.scalars(
            select(Booking)
            .where(Booking.subscription_cycle_id == cycle.id, Booking.status == BookingStatus.held)
            .with_for_update()
        )
    ).all()
    for visit in visits:
        visit.status = BookingStatus.confirmed
        visit.hold_expires_at = None
    cycle.status = CycleStatus.confirmed
    cycle.hold_expires_at = None
    subscription = (
        await session.execute(
            select(Subscription).where(Subscription.id == cycle.subscription_id).with_for_update()
        )
    ).scalar_one()
    subscription.status = SubscriptionStatus.active
    audit.record(
        session,
        None,
        "subscription.cycle_confirmed",
        "subscription",
        subscription.id,
        cycle_id=cycle.id,
        payment_id=payment.id,
        visits=len(visits),
    )
    return True


async def simulate_outcome(session: AsyncSession, customer: User, payment_id: int, outcome: str) -> Payment:
    async with session.begin():
        payment = await session.get(Payment, payment_id)
        if payment is None:
            raise AppError(404, "not_found", "Payment not found")
        if payment.booking_id is not None:
            await get_visible_booking(session, customer, payment.booking_id)
        else:
            cycle = await session.get(SubscriptionCycle, payment.subscription_cycle_id)
            assert cycle is not None
            await _owned_subscription(session, customer, cycle.subscription_id)
        ref = payment.provider_ref
    body, signature = sandbox.build_event(ref, outcome)
    await handle_sandbox_webhook(session, body, signature)
    async with session.begin():
        refreshed = await session.get(Payment, payment_id, populate_existing=True)
        assert refreshed is not None
    return refreshed
