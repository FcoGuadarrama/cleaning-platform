import json
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select, update
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
    PaymentMethod,
    PaymentStatus,
    Subscription,
    SubscriptionCycle,
    SubscriptionStatus,
    User,
    WebhookEvent,
)
from app.payments import sandbox, spei
from app.schemas import AdminTransferOut, PaymentOut, TransferInstructions
from app.services import audit, outbox
from app.services.scheduling import get_visible_booking


def present(payment: Payment) -> PaymentOut:
    """A SPEI payment carries the transfer instructions the customer needs."""
    out = PaymentOut.model_validate(payment)
    if payment.method != PaymentMethod.spei:
        return out
    settings = get_settings()
    transfer = TransferInstructions(
        clabe=settings.spei_clabe,
        bank=settings.spei_bank,
        beneficiary=settings.spei_beneficiary,
        reference=payment.provider_ref,
        amount_minor=payment.amount_minor,
        currency=payment.currency,
    )
    return out.model_copy(update={"transfer": transfer})


def _require_spei_account() -> None:
    settings = get_settings()
    if not (settings.spei_clabe and settings.spei_bank and settings.spei_beneficiary):
        raise conflict("spei_unavailable", "Bank transfer is not available yet")


def spei_deadline(current: datetime | None) -> datetime:
    """A SPEI checkout keeps the hold `SPEI_HOLD_HOURS` (owner decision 2026-11-11: 24 h) for the agent."""
    extended = utcnow() + timedelta(hours=get_settings().spei_hold_hours)
    return max(current, extended) if current is not None else extended


async def pending_or_new(
    session: AsyncSession,
    actor_id: int | None,
    method: PaymentMethod,
    *,
    amount_minor: int,
    currency: str,
    booking_id: int | None = None,
    cycle_id: int | None = None,
) -> Payment:
    """Reuses the pending attempt for the same target, so retrying checkout never opens a second charge. A
    pending attempt by the other method blocks a switch: a card charge or a transfer may still land."""
    target = Payment.booking_id == booking_id if booking_id else Payment.subscription_cycle_id == cycle_id
    pending = await session.scalar(select(Payment).where(target, Payment.status == PaymentStatus.pending))
    if pending is not None:
        if pending.method != method:
            raise conflict("payment_in_progress", f"A {pending.method.value} payment is already in progress")
        return pending
    spei_payment = method == PaymentMethod.spei
    payment = Payment(
        booking_id=booking_id,
        subscription_cycle_id=cycle_id,
        method=method,
        provider=spei.PROVIDER if spei_payment else sandbox.PROVIDER,
        provider_ref=spei.new_reference() if spei_payment else sandbox.new_reference(),
        status=PaymentStatus.pending,
        amount_minor=amount_minor,
        currency=currency,
    )
    session.add(payment)
    await session.flush()
    audit.record(session, actor_id, "payment.checkout_started", "payment", payment.id, method=method.value)
    return payment


@retry_on_lock_conflict
async def start_checkout(
    session: AsyncSession, customer: User, booking_id: int, method: PaymentMethod
) -> Payment:
    if method == PaymentMethod.spei:
        _require_spei_account()
    async with session.begin():
        booking = await get_visible_booking(session, customer, booking_id, lock=True)
        if booking.status != BookingStatus.held or booking.hold_expires_at is None:
            raise conflict("booking_not_payable", "Booking is not awaiting payment")
        if booking.hold_expires_at <= utcnow():
            raise conflict("hold_expired", "The reservation hold expired")
        payment = await pending_or_new(
            session,
            customer.id,
            method,
            amount_minor=booking.price_minor,
            currency=booking.currency,
            booking_id=booking.id,
        )
        if method == PaymentMethod.spei:
            booking.hold_expires_at = spei_deadline(booking.hold_expires_at)
        return payment


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
async def start_subscription_checkout(
    session: AsyncSession, customer: User, subscription_id: int, method: PaymentMethod
) -> Payment:
    """Charges the subscription's held cycle: the first one while contracting, or a renewal awaiting payment.
    The method becomes the one renewals use. SPEI extends the first cycle's hold; a renewal keeps its
    deadline (the day before its first visit). Lock order: subscription, cycle, visits."""
    if method == PaymentMethod.spei:
        _require_spei_account()
    async with session.begin():
        subscription = await _owned_subscription(session, customer, subscription_id, lock=True)
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
        payment = await pending_or_new(
            session,
            customer.id,
            method,
            amount_minor=cycle.price_minor,
            currency=cycle.currency,
            cycle_id=cycle.id,
        )
        subscription.payment_method = method
        if method == PaymentMethod.spei and cycle.sequence == 1:
            cycle.hold_expires_at = spei_deadline(cycle.hold_expires_at)
            await session.execute(
                update(Booking)
                .where(Booking.subscription_cycle_id == cycle.id, Booking.status == BookingStatus.held)
                .values(hold_expires_at=cycle.hold_expires_at)
            )
        return payment


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
            select(Payment)
            .where(Payment.provider_ref == event["data"]["reference"], Payment.provider == sandbox.PROVIDER)
            .with_for_update()
        )
    ).scalar_one_or_none()
    if payment is None:
        raise AppError(400, "unknown_payment", "Unknown payment reference")
    await _settle(session, payment, succeeded=event["type"] != "payment.failed")


async def _settle(session: AsyncSession, payment: Payment, *, succeeded: bool) -> None:
    """Applies a payment outcome once; call with the payment locked. Only a pending payment changes. A success
    that comes after its hold lapsed is flagged for refund instead of confirming anything."""
    if payment.status != PaymentStatus.pending:
        return
    if not succeeded:
        payment.status = PaymentStatus.failed
        audit.record(session, None, "payment.failed", "payment", payment.id)
        outbox.publish(session, "payment.failed", payment.id, payment_id=payment.id)
        return
    payment.status = PaymentStatus.succeeded
    confirmed = await (
        _confirm_booking(session, payment) if payment.booking_id else _confirm_cycle(session, payment)
    )
    if not confirmed:
        payment.needs_refund = True
        audit.record(session, None, "payment.late_success_needs_refund", "payment", payment.id)
        outbox.publish(session, "payment.needs_refund", payment.id, payment_id=payment.id)


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
    outbox.publish(session, "booking.confirmed", booking.id, booking_id=booking.id, payment_id=payment.id)
    return True


async def _confirm_cycle(session: AsyncSession, payment: Payment) -> bool:
    """Lock order: payment, subscription, cycle, its visits (also cancellation's, renewal's and the hold
    sweep's). Confirms every visit of the cycle at once."""
    subscription_id = await session.scalar(
        select(SubscriptionCycle.subscription_id).where(SubscriptionCycle.id == payment.subscription_cycle_id)
    )
    locked = select(Subscription).where(Subscription.id == subscription_id).with_for_update()
    subscription = (await session.execute(locked)).scalar_one()
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
    outbox.publish(
        session,
        "subscription.cycle_confirmed",
        cycle.id,
        subscription_id=subscription.id,
        cycle_id=cycle.id,
        payment_id=payment.id,
    )
    return True


async def pending_payment(
    session: AsyncSession,
    customer: User,
    *,
    booking_id: int | None = None,
    subscription_id: int | None = None,
) -> Payment:
    """The customer's pending payment for a held booking or a subscription's held cycle (to show a transfer's
    instructions again)."""
    async with session.begin():
        if booking_id is not None:
            await get_visible_booking(session, customer, booking_id)
            target = Payment.booking_id == booking_id
        else:
            assert subscription_id is not None
            await _owned_subscription(session, customer, subscription_id)
            held = select(SubscriptionCycle.id).where(
                SubscriptionCycle.subscription_id == subscription_id,
                SubscriptionCycle.status == CycleStatus.held,
            )
            target = Payment.subscription_cycle_id.in_(held)
        payment = await session.scalar(select(Payment).where(target, Payment.status == PaymentStatus.pending))
        if payment is None:
            raise not_found("Pending payment")
        return payment


async def charge_saved_card(session: AsyncSession, payment_id: int) -> None:
    """Renewal charge of the card on file, outside any transaction. The sandbox answers with
    `SANDBOX_RENEWAL_OUTCOME` through the webhook path, as a provider would; a live provider charges a
    tokenized card with `provider_ref` as its idempotency key (decision 3)."""
    async with session.begin():
        reference = (await session.get_one(Payment, payment_id)).provider_ref
    body, signature = sandbox.build_event(reference, get_settings().sandbox_renewal_outcome)
    await handle_sandbox_webhook(session, body, signature)


async def simulate_outcome(session: AsyncSession, customer: User, payment_id: int, outcome: str) -> Payment:
    """Sandbox card payments only: a SPEI transfer is confirmed by an agent, never by the customer."""
    async with session.begin():
        payment = await session.get(Payment, payment_id)
        if payment is None:
            raise AppError(404, "not_found", "Payment not found")
        if payment.method != PaymentMethod.card:
            raise conflict("not_a_card_payment", "Only a card payment has a sandbox outcome")
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


async def _pending_transfer(session: AsyncSession, payment_id: int) -> Payment:
    payment = (
        await session.execute(select(Payment).where(Payment.id == payment_id).with_for_update())
    ).scalar_one_or_none()
    if payment is None or payment.method != PaymentMethod.spei:
        raise not_found("Transfer")
    if payment.status != PaymentStatus.pending:
        raise conflict("transfer_reviewed", "This transfer was already reviewed")
    return payment


@retry_on_lock_conflict
async def confirm_transfer(session: AsyncSession, admin: User, payment_id: int, note: str | None) -> Payment:
    """The agent saw the deposit. Same settlement as a provider success: past the hold, it is flagged for
    refund instead of confirming the slot."""
    async with session.begin():
        payment = await _pending_transfer(session, payment_id)
        payment.reviewed_by, payment.reviewed_at, payment.review_note = admin.id, utcnow(), note
        audit.record(session, admin.id, "payment.transfer_confirmed", "payment", payment.id, note=note)
        await _settle(session, payment, succeeded=True)
    return payment


@retry_on_lock_conflict
async def reject_transfer(session: AsyncSession, admin: User, payment_id: int, note: str) -> Payment:
    """No matching deposit (or the wrong amount). The hold keeps running: the customer can transfer again."""
    async with session.begin():
        payment = await _pending_transfer(session, payment_id)
        payment.reviewed_by, payment.reviewed_at, payment.review_note = admin.id, utcnow(), note
        audit.record(session, admin.id, "payment.transfer_rejected", "payment", payment.id, note=note)
        await _settle(session, payment, succeeded=False)
    return payment


async def pending_transfers(session: AsyncSession) -> list[AdminTransferOut]:
    """Transfers awaiting an agent, oldest first, with what each one pays for and until when it holds."""
    async with session.begin():
        rows = list(
            await session.scalars(
                select(Payment)
                .where(Payment.method == PaymentMethod.spei, Payment.status == PaymentStatus.pending)
                .order_by(Payment.id)
            )
        )
        out = []
        for payment in rows:
            if payment.booking_id is not None:
                booking = await session.get_one(Booking, payment.booking_id)
                customer_id, subscription_id, pay_by = booking.customer_id, None, booking.hold_expires_at
                held = booking.status == BookingStatus.held
            else:
                cycle = await session.get_one(SubscriptionCycle, payment.subscription_cycle_id)
                subscription = await session.get_one(Subscription, cycle.subscription_id)
                customer_id, subscription_id = subscription.customer_id, subscription.id
                pay_by = cycle.hold_expires_at
                held = cycle.status == CycleStatus.held
            out.append(
                AdminTransferOut.model_validate(
                    {
                        **present(payment).model_dump(),
                        "customer_id": customer_id,
                        "subscription_id": subscription_id,
                        "pay_by": pay_by if held else None,
                    }
                )
            )
        return out
