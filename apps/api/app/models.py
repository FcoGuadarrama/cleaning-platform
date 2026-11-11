"""ORM models. Not exposed over HTTP — see app.schemas for transport models."""

import enum
from datetime import date, datetime, time
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.core.timeutil import UTCDateTime, utcnow


class Base(DeclarativeBase):
    pass


def _enum(cls: type[enum.Enum]) -> Enum:
    return Enum(cls, native_enum=False, length=32, values_callable=lambda e: [m.value for m in e])


class Role(enum.StrEnum):
    customer = "customer"
    staff = "staff"
    admin = "admin"


class BookingStatus(enum.StrEnum):
    held = "held"
    expired = "expired"
    confirmed = "confirmed"
    in_progress = "in_progress"
    pending_review = "pending_review"
    completed = "completed"
    disputed = "disputed"
    cancelled = "cancelled"


class PaymentStatus(enum.StrEnum):
    pending = "pending"
    succeeded = "succeeded"
    failed = "failed"


class AttendanceKind(enum.StrEnum):
    check_in = "check_in"
    check_out = "check_out"


class CaptureStatus(enum.StrEnum):
    captured = "captured"
    permission_denied = "permission_denied"
    unavailable = "unavailable"
    network_error = "network_error"
    admin_manual = "admin_manual"


class ExceptionStatus(enum.StrEnum):
    open = "open"
    approved = "approved"
    rejected = "rejected"


class EarningStatus(enum.StrEnum):
    earned = "earned"
    approved = "approved"
    paid = "paid"


class SettlementStatus(enum.StrEnum):
    approved = "approved"
    paid = "paid"


class SubscriptionStatus(enum.StrEnum):
    held = "held"
    active = "active"
    expired = "expired"


class CycleStatus(enum.StrEnum):
    held = "held"
    confirmed = "confirmed"
    expired = "expired"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class User(TimestampMixin, Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[Role] = mapped_column(_enum(Role))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class AuthToken(TimestampMixin, Base):
    __tablename__ = "auth_tokens"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime())


class StaffProfile(TimestampMixin, Base):
    __tablename__ = "staff_profiles"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    display_name: Mapped[str] = mapped_column(String(120))
    bio: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ServiceOffering(TimestampMixin, Base):
    """Immutable once created; a price/earning change is a new row (old one deactivated)."""

    __tablename__ = "service_offerings"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    duration_minutes: Mapped[int] = mapped_column(Integer)
    price_minor: Mapped[int] = mapped_column(BigInteger)
    staff_earning_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="MXN")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


# Owner decision 2026-11-10 (docs/PRODUCT.md, decision 2): a monthly cycle has four visits per chosen weekday;
# a month with a fifth occurrence adds no visit.
VISITS_PER_WEEKDAY_PER_CYCLE = 4


class SubscriptionPlan(TimestampMixin, Base):
    """A monthly plan customers can see. Immutable once created: a change is a new version that replaces
    this row (`replaces_id`), so a future purchase keeps the exact price and terms it accepted."""

    __tablename__ = "subscription_plans"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(String(300), default="")
    days_per_week: Mapped[int] = mapped_column(Integer)
    visit_duration_minutes: Mapped[int] = mapped_column(Integer)
    price_minor: Mapped[int] = mapped_column(BigInteger)
    staff_earning_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="MXN")
    terms: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    replaces_id: Mapped[int | None] = mapped_column(
        ForeignKey("subscription_plans.id", name="fk_subscription_plans_replaces_id"),
        unique=True,
        nullable=True,
    )

    @property
    def visits_per_cycle(self) -> int:
        return self.days_per_week * VISITS_PER_WEEKDAY_PER_CYCLE


class Subscription(TimestampMixin, Base):
    """A customer's contracted plan: same cleaner, weekdays and start time every cycle. Keeps its own copy
    of the plan's price and terms as accepted, so later plan versions never change it."""

    __tablename__ = "subscriptions"
    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff_profiles.id"), index=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("subscription_plans.id"))
    status: Mapped[SubscriptionStatus] = mapped_column(_enum(SubscriptionStatus), index=True)
    weekdays: Mapped[list[int]] = mapped_column(JSON)
    visit_start: Mapped[time] = mapped_column(Time, comment="Local start time in the business time zone")
    address: Mapped[str] = mapped_column(String(500))
    address_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "customer_addresses.id",
            ondelete="SET NULL",
            name="fk_subscriptions_address_id_customer_addresses",
        ),
        nullable=True,
    )
    plan_name: Mapped[str] = mapped_column(String(80))
    days_per_week: Mapped[int] = mapped_column(Integer)
    visits_per_cycle: Mapped[int] = mapped_column(Integer)
    visit_duration_minutes: Mapped[int] = mapped_column(Integer)
    price_minor: Mapped[int] = mapped_column(BigInteger)
    staff_earning_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3))
    terms: Mapped[str] = mapped_column(Text)
    terms_accepted_at: Mapped[datetime] = mapped_column(UTCDateTime())


class SubscriptionCycle(TimestampMixin, Base):
    """One paid period of a subscription (four weeks from its first visit) and the price charged for it."""

    __tablename__ = "subscription_cycles"
    __table_args__ = (UniqueConstraint("subscription_id", "sequence"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    subscription_id: Mapped[int] = mapped_column(ForeignKey("subscriptions.id"), index=True)
    sequence: Mapped[int] = mapped_column(Integer)
    starts_on: Mapped[date] = mapped_column(Date)
    ends_on: Mapped[date] = mapped_column(Date, comment="Last day of the cycle, inclusive")
    status: Mapped[CycleStatus] = mapped_column(_enum(CycleStatus), index=True)
    hold_expires_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    price_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3))


class CustomerAddress(TimestampMixin, Base):
    """A customer's saved service address. Bookings copy it as text, so edits never rewrite past visits."""

    __tablename__ = "customer_addresses"
    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(40))
    street: Mapped[str] = mapped_column(String(200))
    interior: Mapped[str] = mapped_column(String(60), default="")
    neighbourhood: Mapped[str] = mapped_column(String(120))
    postal_code: Mapped[str] = mapped_column(String(5))
    municipality: Mapped[str] = mapped_column(String(120))
    state: Mapped[str] = mapped_column(String(80))
    directions: Mapped[str] = mapped_column(String(300), default="")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)

    def one_line(self) -> str:
        street = f"{self.street}, int. {self.interior}" if self.interior else self.street
        return f"{street}, {self.neighbourhood}, C.P. {self.postal_code}, {self.municipality}, {self.state}"


class Booking(TimestampMixin, Base):
    """One visit: a single visit sold from an offering, or one visit of a subscription cycle (price 0 here;
    the cycle carries the charge)."""

    __tablename__ = "bookings"
    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff_profiles.id"), index=True)
    offering_id: Mapped[int | None] = mapped_column(ForeignKey("service_offerings.id"), nullable=True)
    subscription_cycle_id: Mapped[int | None] = mapped_column(
        ForeignKey("subscription_cycles.id", name="fk_bookings_subscription_cycle_id"),
        nullable=True,
        index=True,
    )
    starts_at: Mapped[datetime] = mapped_column(UTCDateTime(), index=True)
    ends_at: Mapped[datetime] = mapped_column(UTCDateTime())
    status: Mapped[BookingStatus] = mapped_column(_enum(BookingStatus), index=True)
    hold_expires_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    price_minor: Mapped[int] = mapped_column(BigInteger)
    staff_earning_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3))
    address: Mapped[str] = mapped_column(String(500))
    address_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "customer_addresses.id", ondelete="SET NULL", name="fk_bookings_address_id_customer_addresses"
        ),
        nullable=True,
    )


class Payment(TimestampMixin, Base):
    """Pays either one single-visit booking or one subscription cycle, never both."""

    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint(
            "(booking_id IS NULL) <> (subscription_cycle_id IS NULL)", name="ck_payments_one_target"
        ),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id"), index=True, nullable=True)
    subscription_cycle_id: Mapped[int | None] = mapped_column(
        ForeignKey("subscription_cycles.id", name="fk_payments_subscription_cycle_id"),
        nullable=True,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(32))
    provider_ref: Mapped[str] = mapped_column(String(64), unique=True)
    status: Mapped[PaymentStatus] = mapped_column(_enum(PaymentStatus))
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3))
    needs_refund: Mapped[bool] = mapped_column(Boolean, default=False)


class WebhookEvent(TimestampMixin, Base):
    __tablename__ = "webhook_events"
    __table_args__ = (UniqueConstraint("provider", "event_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    provider: Mapped[str] = mapped_column(String(32))
    event_id: Mapped[str] = mapped_column(String(100))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)


class Attendance(TimestampMixin, Base):
    __tablename__ = "attendances"
    __table_args__ = (UniqueConstraint("booking_id", "kind"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"))
    kind: Mapped[AttendanceKind] = mapped_column(_enum(AttendanceKind))
    capture_status: Mapped[CaptureStatus] = mapped_column(_enum(CaptureStatus))
    occurred_at: Mapped[datetime] = mapped_column(UTCDateTime())
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    accuracy_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    low_accuracy: Mapped[bool] = mapped_column(Boolean, default=False)
    recorded_by: Mapped[int] = mapped_column(ForeignKey("users.id"))


class AttendanceException(TimestampMixin, Base):
    __tablename__ = "attendance_exceptions"
    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), index=True)
    attendance_id: Mapped[int] = mapped_column(ForeignKey("attendances.id"), unique=True)
    reason: Mapped[str] = mapped_column(String(32))
    status: Mapped[ExceptionStatus] = mapped_column(_enum(ExceptionStatus))
    resolved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)


class Settlement(TimestampMixin, Base):
    __tablename__ = "settlements"
    # Not unique: a booking completed after its week was approved is settled by a further settlement.
    __table_args__ = (Index("ix_settlements_staff_week", "staff_id", "week_start"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff_profiles.id"))
    week_start: Mapped[date] = mapped_column(Date)
    total_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3))
    status: Mapped[SettlementStatus] = mapped_column(_enum(SettlementStatus))
    approved_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    payout_reference: Mapped[str | None] = mapped_column(String(120), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)


class Earning(TimestampMixin, Base):
    __tablename__ = "earnings"
    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), unique=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff_profiles.id"), index=True)
    week_start: Mapped[date] = mapped_column(Date, index=True)
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3))
    status: Mapped[EarningStatus] = mapped_column(_enum(EarningStatus))
    settlement_id: Mapped[int | None] = mapped_column(ForeignKey("settlements.id"), nullable=True)


class AuditLog(TimestampMixin, Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(64), index=True)
    entity: Mapped[str] = mapped_column(String(32))
    entity_id: Mapped[int] = mapped_column(Integer)
    data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class IdempotencyKey(TimestampMixin, Base):
    """A client's Idempotency-Key for one create. A retry with the same key gets `resource_id` back instead
    of a second resource; the fingerprint rejects reusing the key for a different request."""

    __tablename__ = "idempotency_keys"
    __table_args__ = (UniqueConstraint("user_id", "key", name="uq_idempotency_keys_user_id_key"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    key: Mapped[str] = mapped_column(String(64))
    fingerprint: Mapped[str] = mapped_column(
        String(64), comment="sha256 of the endpoint scope and request body"
    )
    resource_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
