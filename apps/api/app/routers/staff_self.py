from datetime import date

from fastapi import APIRouter

from app.core.errors import ERROR_RESPONSES
from app.core.timeutil import utcnow
from app.deps import SessionDep, StaffDep
from app.schemas import EarningsSummaryOut
from app.services import earnings, scheduling
from app.services.attendance import week_start_for

router = APIRouter(prefix="/me", tags=["staff"], responses=ERROR_RESPONSES)


@router.get("/earnings", name="staff_my_earnings")
async def my_earnings(
    session: SessionDep, user: StaffDep, week_start: date | None = None
) -> EarningsSummaryOut:
    """Current business week by default."""
    profile = await scheduling.staff_profile_for(session, user)
    return await earnings.summary(session, profile.id, week_start or week_start_for(utcnow()))
