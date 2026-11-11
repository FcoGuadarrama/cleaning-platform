from fastapi import APIRouter, Header, Request

from app.core.errors import ERROR_RESPONSES
from app.deps import CustomerDep, IdempotencyKeyHeader, SessionDep, StaffDep, UserDep
from app.models import AttendanceKind, Role
from app.schemas import (
    AttendanceOut,
    AttendanceRequest,
    BookingCreateRequest,
    BookingOut,
    PaymentOut,
    SandboxOutcomeRequest,
    WebhookAck,
)
from app.services import attendance, payments, scheduling

router = APIRouter(tags=["bookings"], responses=ERROR_RESPONSES)


@router.post("/bookings", status_code=201, name="bookings_create_hold")
async def create_hold(
    body: BookingCreateRequest,
    session: SessionDep,
    user: CustomerDep,
    idempotency_key: IdempotencyKeyHeader = None,
) -> BookingOut:
    """A retry with the same `Idempotency-Key` returns the hold the first attempt created."""
    booking = await scheduling.create_hold(session, user, body, idempotency_key)
    return BookingOut.model_validate(booking)


@router.get("/bookings", name="bookings_list")
async def list_bookings(session: SessionDep, user: UserDep) -> list[BookingOut]:
    """Customers: own bookings. Staff: assigned bookings. Admin: all."""
    await scheduling.expire_holds(session)
    staff = await scheduling.staff_profile_for(session, user) if user.role == Role.staff else None
    rows = await session.execute(scheduling.visible_bookings_stmt(user, staff))
    return [BookingOut.model_validate(b) for b in rows.scalars()]


@router.get("/bookings/{booking_id}", name="bookings_get")
async def get_booking(booking_id: int, session: SessionDep, user: UserDep) -> BookingOut:
    await scheduling.expire_holds(session)
    return BookingOut.model_validate(await scheduling.get_visible_booking(session, user, booking_id))


@router.post("/bookings/{booking_id}/checkout", status_code=201, name="bookings_checkout")
async def checkout(booking_id: int, session: SessionDep, user: CustomerDep) -> PaymentOut:
    return PaymentOut.model_validate(await payments.start_checkout(session, user, booking_id))


@router.post("/payments/{payment_id}/sandbox-outcome", name="payments_sandbox_outcome")
async def sandbox_outcome(
    payment_id: int, body: SandboxOutcomeRequest, session: SessionDep, user: CustomerDep
) -> PaymentOut:
    """Sandbox only: emits a signed provider event through the real webhook path."""
    payment = await payments.simulate_outcome(session, user, payment_id, body.outcome.value)
    return PaymentOut.model_validate(payment)


@router.post("/payments/webhooks/sandbox", name="payments_sandbox_webhook")
async def sandbox_webhook(
    request: Request, session: SessionDep, x_sandbox_signature: str = Header()
) -> WebhookAck:
    duplicate = await payments.handle_sandbox_webhook(session, await request.body(), x_sandbox_signature)
    return WebhookAck(received=True, duplicate=duplicate)


@router.post("/bookings/{booking_id}/check-in", status_code=201, name="bookings_check_in")
async def check_in(
    booking_id: int, body: AttendanceRequest, session: SessionDep, user: StaffDep
) -> AttendanceOut:
    """A retry returns the record already stored when the same user recorded it (the first capture wins)."""
    row = await attendance.record_attendance(session, user, booking_id, AttendanceKind.check_in, body)
    return AttendanceOut.model_validate(row)


@router.post("/bookings/{booking_id}/check-out", status_code=201, name="bookings_check_out")
async def check_out(
    booking_id: int, body: AttendanceRequest, session: SessionDep, user: StaffDep
) -> AttendanceOut:
    """A retry returns the record already stored when the same user recorded it (the first capture wins)."""
    row = await attendance.record_attendance(session, user, booking_id, AttendanceKind.check_out, body)
    return AttendanceOut.model_validate(row)
