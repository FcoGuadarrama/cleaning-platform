from datetime import date

from fastapi import APIRouter
from sqlalchemy import select

from app.core.errors import ERROR_RESPONSES
from app.deps import AdminDep, SessionDep
from app.models import AttendanceException, ExceptionStatus, Role, ServiceOffering, StaffProfile
from app.schemas import (
    AttendanceExceptionOut,
    AttendanceOut,
    EarningsSummaryOut,
    ExceptionResolveRequest,
    ManualAttendanceRequest,
    OfferingCreateRequest,
    OfferingOut,
    PayoutRequest,
    SettlementCreateRequest,
    SettlementOut,
    StaffCreateRequest,
    StaffProfileOut,
)
from app.services import attendance, audit, auth, earnings

router = APIRouter(prefix="/admin", tags=["admin"], responses=ERROR_RESPONSES)


@router.post("/staff", status_code=201, name="admin_create_staff")
async def create_staff(body: StaffCreateRequest, session: SessionDep, admin: AdminDep) -> StaffProfileOut:
    async with session.begin():
        user = await auth.create_user(session, body.email, body.password, body.full_name, Role.staff)
        profile = StaffProfile(user_id=user.id, display_name=body.display_name, bio=body.bio)
        session.add(profile)
        await session.flush()
        audit.record(session, admin.id, "staff.provisioned", "staff", profile.id)
    return StaffProfileOut.model_validate(profile)


@router.get("/staff", name="admin_list_staff")
async def list_staff(session: SessionDep, _: AdminDep) -> list[StaffProfileOut]:
    return [
        StaffProfileOut.model_validate(s) for s in (await session.execute(select(StaffProfile))).scalars()
    ]


@router.post("/offerings", status_code=201, name="admin_create_offering")
async def create_offering(body: OfferingCreateRequest, session: SessionDep, admin: AdminDep) -> OfferingOut:
    async with session.begin():
        offering = ServiceOffering(**body.model_dump())
        session.add(offering)
        await session.flush()
        audit.record(session, admin.id, "offering.created", "offering", offering.id, **body.model_dump())
    return OfferingOut.model_validate(offering)


@router.get("/attendance-exceptions", name="admin_list_attendance_exceptions")
async def list_exceptions(session: SessionDep, _: AdminDep) -> list[AttendanceExceptionOut]:
    rows = await session.execute(
        select(AttendanceException).where(AttendanceException.status == ExceptionStatus.open)
    )
    return [AttendanceExceptionOut.model_validate(r) for r in rows.scalars()]


@router.post("/attendance-exceptions/{exception_id}/resolve", name="admin_resolve_attendance_exception")
async def resolve_exception(
    exception_id: int, body: ExceptionResolveRequest, session: SessionDep, admin: AdminDep
) -> AttendanceExceptionOut:
    exc = await attendance.resolve_exception(session, admin, exception_id, body.approve, body.note)
    return AttendanceExceptionOut.model_validate(exc)


@router.post("/bookings/{booking_id}/manual-attendance", status_code=201, name="admin_manual_attendance")
async def manual_attendance(
    booking_id: int, body: ManualAttendanceRequest, session: SessionDep, admin: AdminDep
) -> AttendanceOut:
    row = await attendance.record_manual(session, admin, booking_id, body.kind, body.occurred_at, body.reason)
    return AttendanceOut.model_validate(row)


@router.get("/staff/{staff_id}/earnings", name="admin_staff_earnings")
async def staff_earnings(
    staff_id: int, week_start: date, session: SessionDep, _: AdminDep
) -> EarningsSummaryOut:
    return await earnings.summary(session, staff_id, week_start)


@router.post("/settlements", status_code=201, name="admin_approve_settlement")
async def approve_settlement(
    body: SettlementCreateRequest, session: SessionDep, admin: AdminDep
) -> SettlementOut:
    return SettlementOut.model_validate(
        await earnings.approve_week(session, admin, body.staff_id, body.week_start)
    )


@router.post("/settlements/{settlement_id}/payout", name="admin_record_payout")
async def record_payout(
    settlement_id: int, body: PayoutRequest, session: SessionDep, admin: AdminDep
) -> SettlementOut:
    return SettlementOut.model_validate(
        await earnings.record_payout(session, admin, settlement_id, body.reference)
    )
