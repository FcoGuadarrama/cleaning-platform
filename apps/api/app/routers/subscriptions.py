from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from app.core.errors import ERROR_RESPONSES
from app.deps import CustomerDep, SessionDep, UserDep
from app.schemas import (
    PaymentOut,
    SubscriptionCreateRequest,
    SubscriptionOut,
    SubscriptionScheduleOut,
    Weekday,
)
from app.services import contracting, payments

router = APIRouter(tags=["subscriptions"], responses=ERROR_RESPONSES)


@router.get("/subscription-plans/{plan_id}/schedule", name="subscriptions_schedule")
async def schedule(
    plan_id: int,
    staff_id: int,
    starts_on: date,
    weekdays: Annotated[list[Weekday], Query(min_length=1, max_length=5)],
    session: SessionDep,
    _: UserDep,
) -> SubscriptionScheduleOut:
    """First-cycle visit dates and the start times free on all of them. Advisory: the hold re-checks."""
    return await contracting.schedule(session, plan_id, staff_id, weekdays, starts_on)


@router.post("/subscriptions", status_code=201, name="subscriptions_create_hold")
async def create_hold(
    body: SubscriptionCreateRequest, session: SessionDep, user: CustomerDep
) -> SubscriptionOut:
    """Holds every visit of the first cycle for the checkout TTL. 409 `visits_unavailable` lists the dates
    that are taken (`details.dates`)."""
    subscription_id = await contracting.create_hold(session, user, body)
    return await contracting.get_for_customer(session, user, subscription_id)


@router.get("/subscriptions", name="subscriptions_list")
async def list_subscriptions(session: SessionDep, user: CustomerDep) -> list[SubscriptionOut]:
    """The customer's pending and active subscriptions, newest first."""
    return await contracting.list_for_customer(session, user)


@router.get("/subscriptions/{subscription_id}", name="subscriptions_get")
async def get_subscription(subscription_id: int, session: SessionDep, user: CustomerDep) -> SubscriptionOut:
    return await contracting.get_for_customer(session, user, subscription_id)


@router.post("/subscriptions/{subscription_id}/checkout", status_code=201, name="subscriptions_checkout")
async def checkout(subscription_id: int, session: SessionDep, user: CustomerDep) -> PaymentOut:
    payment = await payments.start_subscription_checkout(session, user, subscription_id)
    return PaymentOut.model_validate(payment)
