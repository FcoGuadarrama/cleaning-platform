"""Pydantic transport models (the public contract). Kept separate from ORM models."""

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator

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


# addresses
Line = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
OptionalLine = Annotated[str, StringConstraints(strip_whitespace=True)]
PostalCode = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\d{5}$")]


class AddressFields(Strict):
    label: Annotated[Line, Field(max_length=40, description="Customer's name for it, e.g. Casa")]
    street: Annotated[Line, Field(max_length=200, description="Street and outdoor number")]
    interior: Annotated[OptionalLine, Field(max_length=60)] = ""
    neighbourhood: Annotated[Line, Field(max_length=120, description="Colonia")]
    postal_code: PostalCode
    municipality: Annotated[Line, Field(max_length=120, description="Municipio o alcaldía")]
    state: Annotated[Line, Field(max_length=80)]
    directions: Annotated[OptionalLine, Field(max_length=300, description="Landmarks for the cleaner")] = ""


class AddressCreateRequest(AddressFields):
    is_default: bool = False


class AddressUpdateRequest(Strict):
    """Partial update; omitted fields keep their value. Only `true` is accepted for is_default."""

    label: Annotated[Line, Field(max_length=40)] | None = None
    street: Annotated[Line, Field(max_length=200)] | None = None
    interior: Annotated[OptionalLine, Field(max_length=60)] | None = None
    neighbourhood: Annotated[Line, Field(max_length=120)] | None = None
    postal_code: PostalCode | None = None
    municipality: Annotated[Line, Field(max_length=120)] | None = None
    state: Annotated[Line, Field(max_length=80)] | None = None
    directions: Annotated[OptionalLine, Field(max_length=300)] | None = None
    is_default: Literal[True] | None = None

    @field_validator("*", mode="before")
    @classmethod
    def _no_explicit_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("omit the field instead of sending null")
        return value


class AddressOut(Out):
    id: int
    label: str
    street: str
    interior: str
    neighbourhood: str
    postal_code: str
    municipality: str
    state: str
    directions: str
    is_default: bool


# bookings
class BookingCreateRequest(Strict):
    staff_id: int
    offering_id: int
    starts_at: AwareDatetime
    address_id: Annotated[int, Field(description="One of the customer's saved addresses")]


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
    address: Annotated[str, Field(description="Address text as it was when the booking was made")]
    address_id: int | None


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
