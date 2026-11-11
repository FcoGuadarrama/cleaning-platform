"""GPS-assisted check-in/out. A failed capture is stored as a failure and opens an admin exception."""

from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import retry_on_lock_conflict
from app.core.errors import AppError, conflict, not_found
from app.core.timeutil import utcnow
from app.models import (
    Attendance,
    AttendanceException,
    AttendanceKind,
    Booking,
    BookingStatus,
    CaptureStatus,
    Earning,
    EarningStatus,
    ExceptionStatus,
    User,
)
from app.schemas import AttendanceRequest
from app.services import audit
from app.services.scheduling import get_visible_booking

_EXPECTED_STATUS = {
    AttendanceKind.check_in: BookingStatus.confirmed,
    AttendanceKind.check_out: BookingStatus.in_progress,
}


def week_start_for(moment: datetime) -> date:
    local = moment.astimezone(get_settings().business_tz).date()
    return local - timedelta(days=local.weekday())


def _validate_capture(req: AttendanceRequest) -> None:
    has_coords = None not in (req.latitude, req.longitude, req.accuracy_m)
    if req.capture_status == CaptureStatus.captured and not has_coords:
        raise AppError(400, "gps_incomplete", "A captured location requires latitude, longitude and accuracy")
    if req.capture_status == CaptureStatus.admin_manual:
        raise AppError(400, "invalid_capture_status", "Manual attendance is admin-only")
    if req.capture_status != CaptureStatus.captured and (
        req.latitude is not None or req.longitude is not None
    ):
        raise AppError(400, "gps_inconsistent", "Coordinates sent with a failed capture status")


@retry_on_lock_conflict
async def record_attendance(
    session: AsyncSession, staff_user: User, booking_id: int, kind: AttendanceKind, req: AttendanceRequest
) -> Attendance:
    _validate_capture(req)
    async with session.begin():
        booking = await get_visible_booking(session, staff_user, booking_id, lock=True)
        if booking.status != _EXPECTED_STATUS[kind]:
            raise conflict("invalid_booking_state", f"Cannot {kind.value} a booking in {booking.status}")
        low = req.accuracy_m is not None and req.accuracy_m > get_settings().gps_low_accuracy_m
        attendance = Attendance(
            booking_id=booking.id,
            kind=kind,
            capture_status=req.capture_status,
            occurred_at=req.occurred_at,
            latitude=req.latitude,
            longitude=req.longitude,
            accuracy_m=req.accuracy_m,
            low_accuracy=low,
            recorded_by=staff_user.id,
        )
        await _insert_attendance(session, attendance)
        if req.capture_status != CaptureStatus.captured:
            session.add(
                AttendanceException(
                    booking_id=booking.id,
                    attendance_id=attendance.id,
                    reason=req.capture_status.value,
                    status=ExceptionStatus.open,
                )
            )
        audit.record(
            session,
            staff_user.id,
            f"attendance.{kind.value}",
            "booking",
            booking.id,
            capture_status=req.capture_status.value,
            low_accuracy=low,
        )
        await _advance(session, booking, kind, staff_user.id)
    return attendance


async def _insert_attendance(session: AsyncSession, attendance: Attendance) -> None:
    session.add(attendance)
    try:
        await session.flush()
    except IntegrityError as exc:
        raise conflict("attendance_exists", "Attendance already recorded") from exc


@retry_on_lock_conflict
async def record_manual(
    session: AsyncSession,
    admin: User,
    booking_id: int,
    kind: AttendanceKind,
    occurred_at: datetime,
    reason: str,
) -> Attendance:
    """Connectivity fallback: admin records attendance; audit trail keeps the reason."""
    async with session.begin():
        booking = (
            await session.execute(select(Booking).where(Booking.id == booking_id).with_for_update())
        ).scalar_one_or_none()
        if booking is None:
            raise not_found("Booking")
        if booking.status != _EXPECTED_STATUS[kind]:
            raise conflict("invalid_booking_state", f"Cannot {kind.value} a booking in {booking.status}")
        attendance = Attendance(
            booking_id=booking.id,
            kind=kind,
            capture_status=CaptureStatus.admin_manual,
            occurred_at=occurred_at,
            recorded_by=admin.id,
        )
        await _insert_attendance(session, attendance)
        audit.record(
            session, admin.id, f"attendance.manual_{kind.value}", "booking", booking.id, reason=reason
        )
        await _advance(session, booking, kind, admin.id)
    return attendance


async def _advance(session: AsyncSession, booking: Booking, kind: AttendanceKind, actor_id: int) -> None:
    if kind == AttendanceKind.check_in:
        booking.status = BookingStatus.in_progress
        return
    if await _exceptions(session, booking.id, ExceptionStatus.rejected):
        booking.status = BookingStatus.disputed
        return
    if await _exceptions(session, booking.id, ExceptionStatus.open):
        booking.status = BookingStatus.pending_review
        return
    await _complete(session, booking, actor_id)


async def _exceptions(
    session: AsyncSession, booking_id: int, status: ExceptionStatus
) -> list[AttendanceException]:
    rows = await session.execute(
        select(AttendanceException).where(
            AttendanceException.booking_id == booking_id, AttendanceException.status == status
        )
    )
    return list(rows.scalars())


async def _complete(session: AsyncSession, booking: Booking, actor_id: int) -> None:
    booking.status = BookingStatus.completed
    session.add(
        Earning(
            booking_id=booking.id,
            staff_id=booking.staff_id,
            week_start=week_start_for(booking.starts_at),
            amount_minor=booking.staff_earning_minor,
            currency=booking.currency,
            status=EarningStatus.earned,
        )
    )
    audit.record(session, actor_id, "booking.completed", "booking", booking.id)


@retry_on_lock_conflict
async def resolve_exception(
    session: AsyncSession, admin: User, exception_id: int, approve: bool, note: str
) -> AttendanceException:
    async with session.begin():
        exc = (
            await session.execute(
                select(AttendanceException).where(AttendanceException.id == exception_id).with_for_update()
            )
        ).scalar_one_or_none()
        if exc is None:
            raise not_found("Exception")
        if exc.status != ExceptionStatus.open:
            raise conflict("exception_resolved", "Exception already resolved")
        exc.status = ExceptionStatus.approved if approve else ExceptionStatus.rejected
        exc.resolved_by, exc.resolution_note, exc.resolved_at = admin.id, note, utcnow()
        audit.record(
            session,
            admin.id,
            f"attendance_exception.{exc.status.value}",
            "booking",
            exc.booking_id,
            note=note,
        )
        booking = (
            await session.execute(select(Booking).where(Booking.id == exc.booking_id).with_for_update())
        ).scalar_one()
        if booking.status == BookingStatus.pending_review:
            if not approve:
                booking.status = BookingStatus.disputed
            elif not await _exceptions(session, booking.id, ExceptionStatus.open):
                await _complete(session, booking, admin.id)
    return exc
