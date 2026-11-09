"""Pydantic transport models (the public contract). Kept separate from ORM models."""

from datetime import date, datetime
from typing import Annotated

from pydantic import AwareDatetime, BaseModel, ConfigDict, EmailStr, Field

from app.models import (
    AttendanceKind,
    BookingStatus,
    CaptureStatus,
    EarningStatus,
    ExceptionStatus,
    PaymentStatus,
    Role,
    SettlementStatus,
)

Money = Annotated[int, Field(ge=0, description="Amount in minor units (centavos)")]
Currency = Annotated[str, Field(pattern=r"^[A-Z]{3}$")]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# auth
class RegisterRequest(Strict):
    email: EmailStr
    password: Annotated[str, Field(min_length=10, max_length=128)]
    full_name: Annotated[str, Field(min_length=1, max_length=120)]


class LoginRequest(Strict):
    email: EmailStr
    password: str


class UserOut(Out):
    id: int
    email: str
    full_name: str
    role: Role


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"  # noqa: S105 - OAuth token type, not a secret
    expires_at: datetime
    user: UserOut


# staff + offerings
class StaffCreateRequest(Strict):
    email: EmailStr
    password: Annotated[str, Field(min_length=10, max_length=128)]
    full_name: Annotated[str, Field(min_length=1, max_length=120)]
    display_name: Annotated[str, Field(min_length=1, max_length=120)]
    bio: Annotated[str, Field(max_length=2000)] = ""


class StaffProfileOut(Out):
    id: int
    display_name: str
    bio: str
    is_active: bool


class OfferingCreateRequest(Strict):
    name: Annotated[str, Field(min_length=1, max_length=120)]
    duration_minutes: Annotated[int, Field(gt=0, le=12 * 60)]
    price_minor: Money
    staff_earning_minor: Money
    currency: Currency = "MXN"


class OfferingOut(Out):
    id: int
    name: str
    duration_minutes: int
    price_minor: int
    staff_earning_minor: int
    currency: str
    is_active: bool


class SlotOut(BaseModel):
    starts_at: datetime
    ends_at: datetime


class AvailabilityOut(BaseModel):
    staff_id: int
    date: date
    timezone: str
    slots: list[SlotOut]


# bookings
class BookingCreateRequest(Strict):
    staff_id: int
    offering_id: int
    starts_at: AwareDatetime
    address: Annotated[str, Field(min_length=5, max_length=500)]


class BookingOut(Out):
    id: int
    customer_id: int
    staff_id: int
    offering_id: int
    starts_at: datetime
    ends_at: datetime
    status: BookingStatus
    hold_expires_at: datetime | None
    price_minor: int
    currency: str
    address: str


class BookingCancelRequest(Strict):
    reason: Annotated[str, Field(min_length=3, max_length=1000)]


class BookingCancelOut(BaseModel):
    booking: BookingOut
    refund_required: bool


class PaymentOut(Out):
    id: int
    booking_id: int
    provider: str
    provider_ref: str
    status: PaymentStatus
    amount_minor: int
    currency: str


class SandboxOutcomeRequest(Strict):
    outcome: PaymentStatus = PaymentStatus.succeeded


class WebhookAck(BaseModel):
    received: bool
    duplicate: bool


# attendance
class AttendanceRequest(Strict):
    capture_status: CaptureStatus
    occurred_at: AwareDatetime
    latitude: Annotated[float | None, Field(ge=-90, le=90)] = None
    longitude: Annotated[float | None, Field(ge=-180, le=180)] = None
    accuracy_m: Annotated[float | None, Field(ge=0)] = None


class ManualAttendanceRequest(Strict):
    kind: AttendanceKind
    occurred_at: AwareDatetime
    reason: Annotated[str, Field(min_length=3, max_length=1000)]


class AttendanceOut(Out):
    id: int
    booking_id: int
    kind: AttendanceKind
    capture_status: CaptureStatus
    occurred_at: datetime
    latitude: float | None
    longitude: float | None
    accuracy_m: float | None
    low_accuracy: bool


class AttendanceExceptionOut(Out):
    id: int
    booking_id: int
    attendance_id: int
    reason: str
    status: ExceptionStatus
    resolution_note: str | None


class ExceptionResolveRequest(Strict):
    approve: bool
    note: Annotated[str, Field(min_length=3, max_length=1000)]


# earnings
class EarningOut(Out):
    id: int
    booking_id: int
    staff_id: int
    week_start: date
    amount_minor: int
    currency: str
    status: EarningStatus


class EarningsSummaryOut(BaseModel):
    staff_id: int
    week_start: date
    currency: str
    earned_minor: int
    approved_minor: int
    paid_minor: int
    items: list[EarningOut]


class SettlementCreateRequest(Strict):
    staff_id: int
    week_start: date


class PayoutRequest(Strict):
    reference: Annotated[str, Field(min_length=1, max_length=120)]


class SettlementOut(Out):
    id: int
    staff_id: int
    week_start: date
    total_minor: int
    currency: str
    status: SettlementStatus
    payout_reference: str | None
