from datetime import date

from fastapi import APIRouter
from sqlalchemy import select

from app.core.config import get_settings
from app.core.errors import ERROR_RESPONSES
from app.deps import SessionDep, UserDep
from app.models import ServiceOffering, StaffProfile
from app.schemas import AvailabilityOut, OfferingOut, SlotOut, StaffProfileOut, SubscriptionPlanOut
from app.services import scheduling, subscriptions

router = APIRouter(tags=["catalog"], responses=ERROR_RESPONSES)


@router.get("/staff", name="catalog_list_staff")
async def list_staff(session: SessionDep, _: UserDep) -> list[StaffProfileOut]:
    rows = await session.execute(select(StaffProfile).where(StaffProfile.is_active.is_(True)))
    return [StaffProfileOut.model_validate(s) for s in rows.scalars()]


@router.get("/offerings", name="catalog_list_offerings")
async def list_offerings(session: SessionDep, _: UserDep) -> list[OfferingOut]:
    rows = await session.execute(select(ServiceOffering).where(ServiceOffering.is_active.is_(True)))
    return [OfferingOut.model_validate(o) for o in rows.scalars()]


@router.get("/subscription-plans", name="catalog_list_subscription_plans")
async def list_subscription_plans(session: SessionDep, _: UserDep) -> list[SubscriptionPlanOut]:
    """Plans customers can see, fewest days per week first."""
    return [SubscriptionPlanOut.model_validate(p) for p in await subscriptions.list_visible(session)]


@router.get("/staff/{staff_id}/availability", name="catalog_staff_availability")
async def staff_availability(
    staff_id: int, offering_id: int, day: date, session: SessionDep, _: UserDep
) -> AvailabilityOut:
    """Advisory only — the booking endpoint re-checks under a lock."""
    slots = await scheduling.availability(session, staff_id, offering_id, day)
    return AvailabilityOut(
        staff_id=staff_id,
        date=day,
        timezone=str(get_settings().business_tz),
        slots=[SlotOut(starts_at=s, ends_at=e) for s, e in slots],
    )
