"""ORM models. Not exposed over HTTP — see app.schemas for transport models."""

import enum
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Date,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
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


class Booking(TimestampMixin, Base):
    __tablename__ = "bookings"
    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff_profiles.id"), index=True)
    offering_id: Mapped[int] = mapped_column(ForeignKey("service_offerings.id"))
    starts_at: Mapped[datetime] = mapped_column(UTCDateTime(), index=True)
    ends_at: Mapped[datetime] = mapped_column(UTCDateTime())
    status: Mapped[BookingStatus] = mapped_column(_enum(BookingStatus), index=True)
    hold_expires_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    price_minor: Mapped[int] = mapped_column(BigInteger)
    staff_earning_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3))
    address: Mapped[str] = mapped_column(String(500))


class Payment(TimestampMixin, Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), index=True)
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
    __table_args__ = (UniqueConstraint("staff_id", "week_start"),)
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
