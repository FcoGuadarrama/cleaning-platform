"""Earned → approved (settlement) → paid (payout). Each step is a separate, audited record."""

from datetime import date

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, conflict, not_found
from app.core.timeutil import utcnow
from app.models import Earning, EarningStatus, Settlement, SettlementStatus, User
from app.schemas import EarningOut, EarningsSummaryOut
from app.services import audit


async def summary(session: AsyncSession, staff_id: int, week_start: date) -> EarningsSummaryOut:
    rows = (
        (
            await session.execute(
                select(Earning)
                .where(Earning.staff_id == staff_id, Earning.week_start == week_start)
                .order_by(Earning.id)
            )
        )
        .scalars()
        .all()
    )
    totals = {status: sum(e.amount_minor for e in rows if e.status == status) for status in EarningStatus}
    return EarningsSummaryOut(
        staff_id=staff_id,
        week_start=week_start,
        currency=rows[0].currency if rows else "MXN",
        earned_minor=totals[EarningStatus.earned],
        approved_minor=totals[EarningStatus.approved],
        paid_minor=totals[EarningStatus.paid],
        items=[EarningOut.model_validate(e) for e in rows],
    )


async def approve_week(session: AsyncSession, admin: User, staff_id: int, week_start: date) -> Settlement:
    if week_start.weekday() != 0:
        raise AppError(400, "invalid_week_start", "week_start must be a Monday")
    async with session.begin():
        earnings = (
            (
                await session.execute(
                    select(Earning)
                    .where(
                        Earning.staff_id == staff_id,
                        Earning.week_start == week_start,
                        Earning.status == EarningStatus.earned,
                    )
                    .with_for_update()
                )
            )
            .scalars()
            .all()
        )
        if not earnings:
            raise conflict("nothing_to_settle", "No earned amounts for that week")
        currencies = {e.currency for e in earnings}
        if len(currencies) != 1:
            raise conflict("mixed_currency", "Earnings use more than one currency")
        settlement = Settlement(
            staff_id=staff_id,
            week_start=week_start,
            total_minor=sum(e.amount_minor for e in earnings),
            currency=currencies.pop(),
            status=SettlementStatus.approved,
            approved_by=admin.id,
        )
        session.add(settlement)
        try:
            await session.flush()
        except IntegrityError as exc:
            raise conflict("settlement_exists", "Week already settled for this staff member") from exc
        for e in earnings:
            e.status, e.settlement_id = EarningStatus.approved, settlement.id
        audit.record(
            session,
            admin.id,
            "settlement.approved",
            "settlement",
            settlement.id,
            total_minor=settlement.total_minor,
        )
    return settlement


async def record_payout(session: AsyncSession, admin: User, settlement_id: int, reference: str) -> Settlement:
    async with session.begin():
        settlement = (
            await session.execute(select(Settlement).where(Settlement.id == settlement_id).with_for_update())
        ).scalar_one_or_none()
        if settlement is None:
            raise not_found("Settlement")
        if settlement.status != SettlementStatus.approved:
            raise conflict("already_paid", "Settlement already paid")
        settlement.status, settlement.payout_reference, settlement.paid_at = (
            SettlementStatus.paid,
            reference,
            utcnow(),
        )
        earnings = (
            await session.execute(select(Earning).where(Earning.settlement_id == settlement.id))
        ).scalars()
        for e in earnings:
            e.status = EarningStatus.paid
        audit.record(session, admin.id, "settlement.paid", "settlement", settlement.id, reference=reference)
    return settlement
