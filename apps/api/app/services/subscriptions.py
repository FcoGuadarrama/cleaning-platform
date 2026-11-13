"""Subscription plan catalog. Plans are versioned like service offerings: a published version is never edited,
so the price and terms a customer accepts can be kept with the purchase once checkout exists."""

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import retry_on_lock_conflict
from app.core.errors import conflict, not_found
from app.models import SubscriptionPlan, User
from app.schemas import SubscriptionPlanRequest
from app.services import audit


async def list_visible(session: AsyncSession) -> Sequence[SubscriptionPlan]:
    rows = await session.execute(
        select(SubscriptionPlan)
        .where(SubscriptionPlan.is_active.is_(True))
        .order_by(SubscriptionPlan.days_per_week, SubscriptionPlan.price_minor, SubscriptionPlan.id)
    )
    return rows.scalars().all()


async def list_all(session: AsyncSession) -> Sequence[SubscriptionPlan]:
    rows = await session.execute(select(SubscriptionPlan).order_by(SubscriptionPlan.id))
    return rows.scalars().all()


@retry_on_lock_conflict
async def create(session: AsyncSession, admin: User, body: SubscriptionPlanRequest) -> SubscriptionPlan:
    async with session.begin():
        plan = SubscriptionPlan(**body.model_dump())
        session.add(plan)
        await session.flush()
        audit.record(session, admin.id, "subscription_plan.created", "subscription_plan", plan.id)
    return plan


async def _lock_current(session: AsyncSession, plan_id: int) -> SubscriptionPlan:
    """Locks the plan row and refuses versions that a newer one already replaced."""
    plan = await session.scalar(
        select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id).with_for_update()
    )
    if plan is None:
        raise not_found("Subscription plan")
    successor = await session.scalar(
        select(SubscriptionPlan.id).where(SubscriptionPlan.replaces_id == plan.id)
    )
    if successor is not None:
        raise conflict("plan_superseded", "A newer version of this plan exists")
    return plan


@retry_on_lock_conflict
async def revise(
    session: AsyncSession, admin: User, plan_id: int, body: SubscriptionPlanRequest
) -> SubscriptionPlan:
    """The new version keeps the old one's visibility; the old one is hidden for good."""
    async with session.begin():
        previous = await _lock_current(session, plan_id)
        plan = SubscriptionPlan(**body.model_dump(), is_active=previous.is_active, replaces_id=previous.id)
        previous.is_active = False
        session.add(plan)
        await session.flush()
        audit.record(
            session,
            admin.id,
            "subscription_plan.revised",
            "subscription_plan",
            plan.id,
            replaces_id=previous.id,
        )
    return plan


@retry_on_lock_conflict
async def set_visibility(
    session: AsyncSession, admin: User, plan_id: int, is_active: bool
) -> SubscriptionPlan:
    async with session.begin():
        plan = await _lock_current(session, plan_id)
        if plan.is_active != is_active:
            plan.is_active = is_active
            action = "subscription_plan.shown" if is_active else "subscription_plan.hidden"
            audit.record(session, admin.id, action, "subscription_plan", plan.id)
    return plan
