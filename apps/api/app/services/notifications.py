"""Turns outbox events into inbox notifications, one per recipient, and queues their push.

Recipients and wording (es-MX) are task 012's table. Texts are rendered from current state when the event is
delivered; a notification is unique per event and recipient, so a redelivered event adds nothing and queues no
second push. Admins get inbox rows only (no devices)."""

import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import insert_unless_duplicate
from app.models import (
    Booking,
    BookingStatus,
    CycleStatus,
    Notification,
    NotificationCategory,
    Payment,
    PaymentMethod,
    Role,
    Settlement,
    StaffProfile,
    Subscription,
    SubscriptionCycle,
    SubscriptionEndReason,
    User,
)
from app.services import outbox, push
from app.services.recurrence import renewal_dates

logger = logging.getLogger(__name__)

PUSH_TOPIC = "push.send"
DAYS = ("lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo")
MONTHS = (
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
)


@dataclass(frozen=True)
class Notice:
    user_id: int
    category: NotificationCategory
    title: str
    body: str
    data: dict[str, int]
    push: bool = True


Renderer = Callable[[AsyncSession, dict[str, Any]], Awaitable[list[Notice]]]


async def deliver(session: AsyncSession, message: outbox.Delivery) -> None:
    """The outbox's delivery: a push for `push.send`, otherwise the event's inbox fan-out."""
    if message.topic == PUSH_TOPIC:
        await push.send(session, message.payload["notification_id"])
        return
    renderer = _RENDERERS.get(message.topic)
    if renderer is None:
        logger.info("outbox %s has no recipients", message.key)
        return
    async with session.begin():
        for notice in await renderer(session, message.payload):
            row = Notification(
                user_id=notice.user_id,
                category=notice.category,
                kind=message.topic,
                title=notice.title,
                body=notice.body,
                data=notice.data,
                source_key=message.key,
            )
            if await insert_unless_duplicate(session, row) and notice.push:
                outbox.publish(session, PUSH_TOPIC, row.id, notification_id=row.id)


# Formatting (business time zone, es-MX).
def _day(day: date) -> str:
    return f"{DAYS[day.weekday()]} {day.day} de {MONTHS[day.month - 1]}"


def _local(at: datetime) -> datetime:
    return at.astimezone(get_settings().business_tz)


def _when(at: datetime) -> str:
    local = _local(at)
    return f"{_day(local.date())} a las {local:%H:%M}"


def _weekdays(days: list[int]) -> str:
    names = [DAYS[d] for d in sorted(days)]
    return names[0] if len(names) == 1 else f"{', '.join(names[:-1])} y {names[-1]}"


def _money(minor: int, currency: str) -> str:
    return f"${minor // 100:,}.{minor % 100:02d} {currency}"


# Loaders.
async def _booking(session: AsyncSession, booking_id: int) -> tuple[Booking, StaffProfile] | None:
    row = (
        await session.execute(
            select(Booking, StaffProfile)
            .join(StaffProfile, StaffProfile.id == Booking.staff_id)
            .where(Booking.id == booking_id)
        )
    ).one_or_none()
    return None if row is None else (row[0], row[1])


async def _subscription(session: AsyncSession, subscription_id: int) -> tuple[Subscription, StaffProfile]:
    row = (
        await session.execute(
            select(Subscription, StaffProfile)
            .join(StaffProfile, StaffProfile.id == Subscription.staff_id)
            .where(Subscription.id == subscription_id)
        )
    ).one()
    return row[0], row[1]


async def _admins(session: AsyncSession) -> list[int]:
    return list(await session.scalars(select(User.id).where(User.role == Role.admin, User.is_active)))


def _to_admins(admins: list[int], title: str, body: str, data: dict[str, int]) -> list[Notice]:
    return [Notice(a, NotificationCategory.operations, title, body, data, push=False) for a in admins]


async def _payment_owner(session: AsyncSession, payment: Payment) -> tuple[int, dict[str, int]]:
    """The customer who pays and what the payment is for (deep link)."""
    if payment.booking_id is not None:
        customer = select(Booking.customer_id).where(Booking.id == payment.booking_id)
        return (await session.execute(customer)).scalar_one(), {"booking_id": payment.booking_id}
    row = (
        await session.execute(
            select(Subscription.customer_id, Subscription.id)
            .join(SubscriptionCycle, SubscriptionCycle.subscription_id == Subscription.id)
            .where(SubscriptionCycle.id == payment.subscription_cycle_id)
        )
    ).one()
    return row[0], {"subscription_id": row[1]}


# Visits.
async def _booking_confirmed(session: AsyncSession, payload: dict[str, Any]) -> list[Notice]:
    found = await _booking(session, payload["booking_id"])
    if found is None:
        return []
    booking, staff = found
    data = {"booking_id": booking.id}
    when = _when(booking.starts_at)
    return [
        Notice(
            booking.customer_id,
            NotificationCategory.visits,
            "Visita confirmada",
            f"Tu limpieza del {when} con {staff.display_name} está confirmada.",
            data,
        ),
        Notice(
            staff.user_id,
            NotificationCategory.visits,
            "Nuevo servicio asignado",
            f"Tienes un servicio el {when}.",
            data,
        ),
    ]


async def _booking_reminder(session: AsyncSession, payload: dict[str, Any]) -> list[Notice]:
    found = await _booking(session, payload["booking_id"])
    if found is None or found[0].status != BookingStatus.confirmed:
        return []
    booking, staff = found
    data, hour = {"booking_id": booking.id}, f"{_local(booking.starts_at):%H:%M}"
    return [
        Notice(
            booking.customer_id,
            NotificationCategory.visits,
            "Tu limpieza es mañana",
            f"{staff.display_name} llega a las {hour}.",
            data,
        ),
        Notice(
            staff.user_id,
            NotificationCategory.visits,
            "Servicio mañana",
            f"Tienes un servicio mañana a las {hour}.",
            data,
        ),
    ]


async def _booking_cancelled(session: AsyncSession, payload: dict[str, Any]) -> list[Notice]:
    found = await _booking(session, payload["booking_id"])
    if found is None:
        return []
    booking, staff = found
    data, when = {"booking_id": booking.id}, _when(booking.starts_at)
    notices = [
        Notice(
            booking.customer_id,
            NotificationCategory.visits,
            "Visita cancelada",
            f"Tu visita del {when} fue cancelada.",
            data,
        )
    ]
    if payload.get("was_confirmed"):
        notices.append(
            Notice(
                staff.user_id,
                NotificationCategory.visits,
                "Servicio cancelado",
                f"Se canceló tu servicio del {when}.",
                data,
            )
        )
    return notices


async def _booking_completed(session: AsyncSession, payload: dict[str, Any]) -> list[Notice]:
    found = await _booking(session, payload["booking_id"])
    if found is None:
        return []
    booking, staff = found
    return [
        Notice(
            booking.customer_id,
            NotificationCategory.visits,
            "Visita completada",
            f"{staff.display_name} terminó tu limpieza. ¡Gracias!",
            {"booking_id": booking.id},
        )
    ]


# Subscriptions.
async def _cycle_confirmed(session: AsyncSession, payload: dict[str, Any]) -> list[Notice]:
    subscription, staff = await _subscription(session, payload["subscription_id"])
    cycle = await session.get(SubscriptionCycle, payload["cycle_id"])
    if cycle is None:
        return []
    data = {"subscription_id": subscription.id}
    period = f"del {_day(cycle.starts_on)} al {_day(cycle.ends_on)}"
    first = cycle.sequence == 1
    notices = [
        Notice(
            subscription.customer_id,
            NotificationCategory.billing,
            "Suscripción activa" if first else "Renovación confirmada",
            f"Recibimos tu pago. Tu plan {subscription.plan_name} cubre {period}.",
            data,
        )
    ]
    if first:
        notices.append(
            Notice(
                staff.user_id,
                NotificationCategory.visits,
                "Nuevo cliente recurrente",
                f"Visitas los {_weekdays(subscription.weekdays)} a las {subscription.visit_start:%H:%M}, "
                f"desde el {_day(cycle.starts_on)}.",
                data,
            )
        )
    return notices


async def _renewal_notice(session: AsyncSession, payload: dict[str, Any]) -> list[Notice]:
    subscription, _ = await _subscription(session, payload["subscription_id"])
    cycle = await session.get(SubscriptionCycle, payload["cycle_id"])
    if cycle is None or subscription.cancelled_at is not None:
        return []
    _, charge_on = renewal_dates(cycle.starts_on, subscription.weekdays)
    return [
        Notice(
            subscription.customer_id,
            NotificationCategory.billing,
            "Tu suscripción se renueva pronto",
            f"Cobraremos tu plan {subscription.plan_name} el {_day(charge_on)}. Si no quieres renovar, "
            "cancela antes en Mi suscripción.",
            {"subscription_id": subscription.id},
        )
    ]


async def _renewal_transfer_due(session: AsyncSession, payload: dict[str, Any]) -> list[Notice]:
    subscription, _ = await _subscription(session, payload["subscription_id"])
    cycle = await session.get(SubscriptionCycle, payload["cycle_id"])
    if cycle is None or cycle.status != CycleStatus.held or cycle.hold_expires_at is None:
        return []
    return [
        Notice(
            subscription.customer_id,
            NotificationCategory.billing,
            "Transferencia pendiente",
            f"Para renovar tu plan {subscription.plan_name}, haz tu transferencia SPEI antes del "
            f"{_when(cycle.hold_expires_at)}.",
            {"subscription_id": subscription.id},
        )
    ]


async def _subscription_cancelled(session: AsyncSession, payload: dict[str, Any]) -> list[Notice]:
    subscription, _ = await _subscription(session, payload["subscription_id"])
    paid_until = await session.scalar(
        select(func.max(SubscriptionCycle.ends_on)).where(
            SubscriptionCycle.subscription_id == subscription.id,
            SubscriptionCycle.status == CycleStatus.confirmed,
        )
    )
    until = f" Tus visitas pagadas siguen hasta el {_day(paid_until)}." if paid_until else ""
    return [
        Notice(
            subscription.customer_id,
            NotificationCategory.billing,
            "Suscripción cancelada",
            f"No habrá más cargos.{until}",
            {"subscription_id": subscription.id},
        )
    ]


async def _subscription_ended(session: AsyncSession, payload: dict[str, Any]) -> list[Notice]:
    subscription, staff = await _subscription(session, payload["subscription_id"])
    data = {"subscription_id": subscription.id}
    body = (
        "No recibimos el pago de la renovación. Puedes contratar un plan de nuevo cuando quieras."
        if subscription.end_reason == SubscriptionEndReason.unpaid
        else f"Terminó tu plan {subscription.plan_name}. Gracias por confiar en nosotros."
    )
    return [
        Notice(subscription.customer_id, NotificationCategory.billing, "Tu suscripción terminó", body, data),
        Notice(
            staff.user_id,
            NotificationCategory.visits,
            "Se liberó un horario",
            f"Ya no tienes las visitas recurrentes de los {_weekdays(subscription.weekdays)} a las "
            f"{subscription.visit_start:%H:%M}.",
            data,
        ),
    ]


# Payments.
async def _payment_failed(session: AsyncSession, payload: dict[str, Any]) -> list[Notice]:
    payment = await session.get(Payment, payload["payment_id"])
    if payment is None:
        return []
    customer_id, data = await _payment_owner(session, payment)
    reason = (
        "No pudimos confirmar tu transferencia."
        if payment.method == PaymentMethod.spei
        else "Tu tarjeta fue rechazada."
    )
    retry = " Lo intentaremos de nuevo el siguiente día hábil." if payment.charge_on else ""
    return [
        Notice(customer_id, NotificationCategory.billing, "No pudimos procesar tu pago", reason + retry, data)
    ]


async def _transfer_pending(session: AsyncSession, payload: dict[str, Any]) -> list[Notice]:
    payment = await session.get(Payment, payload["payment_id"])
    if payment is None:
        return []
    return _to_admins(
        await _admins(session),
        "Transferencia por revisar",
        f"Referencia {payment.provider_ref} · {_money(payment.amount_minor, payment.currency)}",
        {"payment_id": payment.id},
    )


async def _needs_refund(session: AsyncSession, payload: dict[str, Any]) -> list[Notice]:
    payment = await session.get(Payment, payload["payment_id"])
    if payment is None:
        return []
    return _to_admins(
        await _admins(session),
        "Reembolso pendiente",
        f"El pago {payment.provider_ref} llegó cuando la reserva ya había vencido.",
        {"payment_id": payment.id},
    )


async def _renewal_blocked(session: AsyncSession, payload: dict[str, Any]) -> list[Notice]:
    subscription_id = payload["subscription_id"]
    return _to_admins(
        await _admins(session),
        "Renovación bloqueada",
        f"La suscripción #{subscription_id} no pudo renovarse: hay visitas en su horario.",
        {"subscription_id": subscription_id},
    )


# Operations and staff.
async def _exception_opened(session: AsyncSession, payload: dict[str, Any]) -> list[Notice]:
    return _to_admins(
        await _admins(session),
        "Excepción de asistencia",
        f"Un registro del servicio #{payload['booking_id']} no tiene ubicación. Revísalo para cerrarlo.",
        {"booking_id": payload["booking_id"]},
    )


async def _settlement_paid(session: AsyncSession, payload: dict[str, Any]) -> list[Notice]:
    row = (
        await session.execute(
            select(Settlement, StaffProfile.user_id)
            .join(StaffProfile, StaffProfile.id == Settlement.staff_id)
            .where(Settlement.id == payload["settlement_id"])
        )
    ).one_or_none()
    if row is None:
        return []
    settlement, staff_user = row
    return [
        Notice(
            staff_user,
            NotificationCategory.payouts,
            "Pago registrado",
            f"Se registró el pago de tu semana del {_day(settlement.week_start)}. Míralo en Ganancias.",
            {"settlement_id": settlement.id},
        )
    ]


_RENDERERS: dict[str, Renderer] = {
    "booking.confirmed": _booking_confirmed,
    "booking.reminder": _booking_reminder,
    "booking.cancelled": _booking_cancelled,
    "booking.completed": _booking_completed,
    "subscription.cycle_confirmed": _cycle_confirmed,
    "subscription.renewal_notice": _renewal_notice,
    "subscription.renewal_transfer_due": _renewal_transfer_due,
    "subscription.cancelled": _subscription_cancelled,
    "subscription.ended": _subscription_ended,
    "subscription.renewal_blocked": _renewal_blocked,
    "payment.failed": _payment_failed,
    "payment.transfer_pending": _transfer_pending,
    "payment.needs_refund": _needs_refund,
    "attendance.exception_opened": _exception_opened,
    "settlement.paid": _settlement_paid,
}
