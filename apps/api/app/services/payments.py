import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError, conflict
from app.core.security import verify_signature
from app.core.timeutil import utcnow
from app.models import Booking, BookingStatus, Payment, PaymentStatus, User, WebhookEvent
from app.payments import sandbox
from app.services import audit
from app.services.scheduling import get_visible_booking


async def start_checkout(session: AsyncSession, customer: User, booking_id: int) -> Payment:
    async with session.begin():
        booking = await get_visible_booking(session, customer, booking_id, lock=True)
        if booking.status != BookingStatus.held or booking.hold_expires_at is None:
            raise conflict("booking_not_payable", "Booking is not awaiting payment")
        if booking.hold_expires_at <= utcnow():
            raise conflict("hold_expired", "The reservation hold expired")
        pending = (
            await session.execute(
                select(Payment).where(
                    Payment.booking_id == booking.id, Payment.status == PaymentStatus.pending
                )
            )
        ).scalar_one_or_none()
        if pending is not None:
            return pending
        payment = Payment(
            booking_id=booking.id,
            provider=sandbox.PROVIDER,
            provider_ref=sandbox.new_reference(),
            status=PaymentStatus.pending,
            amount_minor=booking.price_minor,
            currency=booking.currency,
        )
        session.add(payment)
        await session.flush()
        audit.record(session, customer.id, "payment.checkout_started", "payment", payment.id)
    return payment


async def handle_sandbox_webhook(session: AsyncSession, body: bytes, signature: str) -> bool:
    """Returns True when the event was a replay. Signature is verified before parsing."""
    if not verify_signature(body, signature, get_settings().sandbox_webhook_secret):
        raise AppError(400, "invalid_signature", "Invalid webhook signature")
    event: dict[str, Any] = json.loads(body)
    try:
        async with session.begin():
            session.add(WebhookEvent(provider=sandbox.PROVIDER, event_id=str(event["id"]), payload=event))
            await session.flush()
            await _apply_event(session, event)
    except IntegrityError:
        return True
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
    booking = (
        await session.execute(select(Booking).where(Booking.id == payment.booking_id).with_for_update())
    ).scalar_one()
    if event["type"] == "payment.failed":
        payment.status = PaymentStatus.failed
        audit.record(session, None, "payment.failed", "payment", payment.id)
        return
    payment.status = PaymentStatus.succeeded
    hold_valid = (
        booking.status == BookingStatus.held
        and booking.hold_expires_at is not None
        and booking.hold_expires_at > utcnow()
    )
    if hold_valid:
        booking.status = BookingStatus.confirmed
        booking.hold_expires_at = None
        audit.record(session, None, "booking.confirmed", "booking", booking.id, payment_id=payment.id)
    else:
        payment.needs_refund = True
        audit.record(session, None, "payment.late_success_needs_refund", "payment", payment.id)


async def simulate_outcome(session: AsyncSession, customer: User, payment_id: int, outcome: str) -> Payment:
    async with session.begin():
        payment = await session.get(Payment, payment_id)
        if payment is None:
            raise AppError(404, "not_found", "Payment not found")
        await get_visible_booking(session, customer, payment.booking_id)
        ref = payment.provider_ref
    body, signature = sandbox.build_event(ref, outcome)
    await handle_sandbox_webhook(session, body, signature)
    async with session.begin():
        refreshed = await session.get(Payment, payment_id, populate_existing=True)
        assert refreshed is not None
    return refreshed
