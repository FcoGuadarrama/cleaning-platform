"""Fill a local dev database with demo data for the dashboard: uv run python -m app.seed_demo

Creates one customer (test@test.com), four cleaners (test+<name>@test.com), offerings and about six weeks of
bookings with payments, attendance, earnings and settlements. Every account uses ADMIN_PASSWORD from
.env.worktree. Prices and pay are placeholders for the demo, not approved business values.

Refuses to run against a non-local database and does nothing if test@test.com already exists.
"""

import asyncio
import os
import random
import sys
from datetime import UTC, date, datetime, time, timedelta
from urllib.parse import urlparse

from sqlalchemy import select

from app.core.config import get_settings
from app.core.db import get_engine, get_sessionmaker
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
    Payment,
    PaymentStatus,
    Role,
    ServiceOffering,
    Settlement,
    SettlementStatus,
    StaffProfile,
    User,
)
from app.services import auth
from app.services.attendance import week_start_for

LOCAL_DB_HOSTS = {"127.0.0.1", "localhost", "mysql"}
CUSTOMER_EMAIL = "test@test.com"
STAFF = [
    ("ana", "Ana Torres Vega", "Ana Torres", "Ocho años en limpieza residencial en Roma y Condesa.", True),
    ("luis", "Luis Méndez Ortiz", "Luis Méndez", "Limpieza profunda y entregas de departamento.", True),
    ("majo", "María José Ruiz", "María José Ruiz", "", True),
    ("rosa", "Rosa Hernández Gil", "Rosa Hernández", "Planchado y lavandería.", False),
]
OFFERINGS = [
    ("Limpieza general", 180, 65_000, 40_000, True),
    ("Limpieza profunda", 300, 120_000, 75_000, True),
    ("Planchado", 120, 38_000, 24_000, True),
    ("Limpieza general", 180, 59_000, 36_000, False),
]
ADDRESSES = [
    "Colima 214, int. 3, Roma Norte",
    "Ámsterdam 88, Condesa",
    "Tonalá 45, Roma Sur",
    "Av. Coyoacán 1530, Del Valle",
    "Pilares 312, Letrán Valle",
    "Río Lerma 120, Cuauhtémoc",
    "Sullivan 43, San Rafael",
    "Durango 199, Roma Norte",
    "Mazatlán 5, Condesa",
    "Insurgentes Sur 1235, Extremadura Insurgentes",
    "Eje 7 Sur 230, Insurgentes Mixcoac",
    "Medellín 67, Roma Norte",
    "Puebla 150, Roma Norte",
    "Félix Cuevas 301, Tlacoquemécatl",
    "Holbein 112, Ciudad de los Deportes",
]
START_HOURS = [8, 11, 14, 17]
DAYS_BACK = 42
DAYS_AHEAD = 7


def _require_local_db() -> None:
    host = urlparse(os.environ["DATABASE_URL"].replace("mysql+asyncmy", "mysql")).hostname
    if host not in LOCAL_DB_HOSTS:
        sys.exit(f"refusing to seed demo data into non-local database host {host!r}")


def _status_for(start: datetime, end: datetime, now: datetime, rng: random.Random) -> BookingStatus:
    if end <= now:
        roll = rng.random()
        if roll < 0.06:
            return BookingStatus.cancelled
        if roll < 0.08:
            return BookingStatus.disputed
        if end > now - timedelta(days=2) and roll < 0.14:
            return BookingStatus.pending_review
        return BookingStatus.completed
    if start <= now:
        return BookingStatus.in_progress
    return BookingStatus.held if rng.random() < 0.15 else BookingStatus.confirmed


async def main() -> None:
    _require_local_db()
    password = os.environ["ADMIN_PASSWORD"]
    tz = get_settings().business_tz
    rng = random.Random(20261105)  # noqa: S311 - reproducible demo data, not a security context
    now = utcnow()
    today = now.astimezone(tz).date()
    this_week = today - timedelta(days=today.weekday())

    async with get_sessionmaker()() as session, session.begin():
        if (await session.execute(select(User).where(User.email == CUSTOMER_EMAIL))).scalar_one_or_none():
            print(f"demo data already present ({CUSTOMER_EMAIL} exists); nothing to do")
            return
        admin = (await session.execute(select(User).where(User.role == Role.admin))).scalars().first()
        if admin is None:
            sys.exit("create the admin first: python -m app.create_admin admin@admin.com")

        customer = await auth.create_user(
            session, CUSTOMER_EMAIL, password, "Cliente de prueba", Role.customer
        )
        staff: list[tuple[StaffProfile, User]] = []
        for slug, full_name, display, bio, active in STAFF:
            user = await auth.create_user(session, f"test+{slug}@test.com", password, full_name, Role.staff)
            profile = StaffProfile(user_id=user.id, display_name=display, bio=bio, is_active=active)
            session.add(profile)
            staff.append((profile, user))
        offerings = [
            ServiceOffering(name=n, duration_minutes=d, price_minor=p, staff_earning_minor=e, is_active=a)
            for n, d, p, e, a in OFFERINGS
        ]
        session.add_all(offerings)
        await session.flush()

        active_offerings = [o for o in offerings if o.is_active]
        bookings: list[Booking] = []
        for offset in range(-DAYS_BACK, DAYS_AHEAD + 1):
            day = today + timedelta(days=offset)
            if day.weekday() == 6:
                continue
            for profile, _ in staff:
                if not profile.is_active and offset > -21:
                    continue
                hours = sorted(rng.sample(START_HOURS, rng.choice([0, 1, 2, 2, 3])))
                busy_until = 0
                for hour in hours:
                    if hour < busy_until:
                        continue
                    offering = rng.choice(active_offerings)
                    start = datetime.combine(day, time(hour), tz).astimezone(UTC)
                    end = start + timedelta(minutes=offering.duration_minutes)
                    busy_until = hour + offering.duration_minutes // 60
                    status = _status_for(start, end, now, rng)
                    held_until = now + timedelta(minutes=15) if status == BookingStatus.held else None
                    bookings.append(
                        Booking(
                            customer_id=customer.id,
                            staff_id=profile.id,
                            offering_id=offering.id,
                            starts_at=start,
                            ends_at=end,
                            status=status,
                            hold_expires_at=held_until,
                            price_minor=offering.price_minor,
                            staff_earning_minor=offering.staff_earning_minor,
                            currency=offering.currency,
                            address=rng.choice(ADDRESSES),
                        )
                    )
        session.add_all(bookings)
        await session.flush()

        staff_user = {profile.id: user.id for profile, user in staff}
        earnings_by_week: dict[tuple[int, date], list[Earning]] = {}
        exceptions_left = 2
        for b in bookings:
            if b.status not in (BookingStatus.held, BookingStatus.cancelled):
                session.add(
                    Payment(
                        booking_id=b.id,
                        provider="sandbox",
                        provider_ref=f"demo-{b.id}",
                        status=PaymentStatus.succeeded,
                        amount_minor=b.price_minor,
                        currency=b.currency,
                    )
                )
            if b.status in (BookingStatus.held, BookingStatus.confirmed, BookingStatus.cancelled):
                continue
            recent = b.ends_at > now - timedelta(days=3)
            missing_gps = exceptions_left > 0 and b.status == BookingStatus.completed and recent
            check_in = Attendance(
                booking_id=b.id,
                kind=AttendanceKind.check_in,
                capture_status=CaptureStatus.permission_denied if missing_gps else CaptureStatus.captured,
                occurred_at=b.starts_at + timedelta(minutes=rng.randint(-5, 10)),
                latitude=None if missing_gps else 19.41 + rng.random() / 50,
                longitude=None if missing_gps else -99.17 + rng.random() / 50,
                accuracy_m=None if missing_gps else rng.uniform(5, 40),
                recorded_by=staff_user[b.staff_id],
            )
            session.add(check_in)
            if missing_gps:
                await session.flush()
                session.add(
                    AttendanceException(
                        booking_id=b.id,
                        attendance_id=check_in.id,
                        reason="permission_denied",
                        status=ExceptionStatus.open,
                    )
                )
                exceptions_left -= 1
            if b.status == BookingStatus.completed:
                week = week_start_for(b.starts_at)
                earning = Earning(
                    booking_id=b.id,
                    staff_id=b.staff_id,
                    week_start=week,
                    amount_minor=b.staff_earning_minor,
                    currency=b.currency,
                    status=EarningStatus.earned,
                )
                session.add(earning)
                earnings_by_week.setdefault((b.staff_id, week), []).append(earning)

        # Weeks before last are settled and paid; the last two stay open for the settlements screen.
        for (staff_id, week), rows in earnings_by_week.items():
            if week >= this_week - timedelta(days=7):
                continue
            settlement = Settlement(
                staff_id=staff_id,
                week_start=week,
                total_minor=sum(e.amount_minor for e in rows),
                currency=rows[0].currency,
                status=SettlementStatus.paid,
                approved_by=admin.id,
                payout_reference=f"DEMO-{week:%Y%m%d}-{staff_id}",
                paid_at=datetime.combine(week + timedelta(days=7), time(12), tz).astimezone(UTC),
            )
            session.add(settlement)
            await session.flush()
            for e in rows:
                e.status = EarningStatus.paid
                e.settlement_id = settlement.id

    await get_engine().dispose()
    print(f"demo data created: {len(bookings)} bookings, {len(STAFF)} staff, {len(OFFERINGS)} offerings")


if __name__ == "__main__":
    asyncio.run(main())
