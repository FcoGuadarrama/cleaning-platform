"""Pydantic transport models (the public contract). Kept separate from ORM models."""

from datetime import date, datetime, time
from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator

from app.models import (
    AttendanceKind,
    BookingStatus,
    CaptureStatus,
    CycleStatus,
    EarningStatus,
    ExceptionStatus,
    NotificationCategory,
    PaymentMethod,
    PaymentStatus,
    Role,
    SettlementStatus,
    SubscriptionEndReason,
    SubscriptionStatus,
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


# subscription plans
class SubscriptionPlanRequest(Strict):
    """Creates a plan, or a new version of one. Every field is required: a version is a full snapshot."""

    name: Annotated[Line, Field(max_length=80)]
    description: Annotated[
        OptionalLine, Field(max_length=300, description="One line shown under the name")
    ] = ""
    days_per_week: Annotated[int, Field(ge=1, le=5, description="Weekdays (Mon–Fri) the customer chooses")]
    visit_duration_minutes: Annotated[int, Field(gt=0, le=12 * 60)]
    price_minor: Annotated[int, Field(gt=0, description="Monthly price in minor units (centavos)")]
    staff_earning_minor: Annotated[Money, Field(description="Paid to the cleaner per completed visit")]
    currency: Currency = "MXN"
    terms: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10_000)]


class SubscriptionPlanVisibilityRequest(Strict):
    is_active: Annotated[bool, Field(description="Whether customers see the plan")]


class SubscriptionPlanOut(Out):
    """What customers see. The cleaner's pay stays in the admin view."""

    id: int
    name: str
    description: str
    days_per_week: int
    visits_per_cycle: Annotated[int, Field(description="Visits per monthly cycle: four per chosen weekday")]
    visit_duration_minutes: int
    price_minor: int
    currency: str
    terms: str


class AdminSubscriptionPlanOut(SubscriptionPlanOut):
    staff_earning_minor: int
    is_active: bool
    replaces_id: Annotated[int | None, Field(description="The version this one replaced")]
    created_at: datetime


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
    offering_id: Annotated[int | None, Field(description="Set for a single visit")]
    subscription_cycle_id: Annotated[
        int | None, Field(description="Set for a subscription visit; price_minor is 0, the cycle is charged")
    ]
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


class TransferInstructions(BaseModel):
    """Where and how to send a SPEI transfer; the agent matches it by `reference`."""

    clabe: str
    bank: str
    beneficiary: str
    reference: Annotated[str, Field(description="Concept to write in the transfer")]
    amount_minor: int
    currency: str


class PaymentOut(Out):
    """Exactly one of booking_id and subscription_cycle_id is set."""

    id: int
    booking_id: int | None
    subscription_cycle_id: int | None
    method: PaymentMethod
    provider: str
    provider_ref: str
    status: PaymentStatus
    amount_minor: int
    currency: str
    created_at: datetime
    transfer: Annotated[TransferInstructions | None, Field(description="Set for a SPEI payment")] = None


class CheckoutRequest(Strict):
    method: Annotated[
        PaymentMethod,
        Field(description="card: paid at once. spei: holds the slot 24 h until an agent confirms it"),
    ] = PaymentMethod.card


class AdminTransferOut(PaymentOut):
    customer_id: int
    subscription_id: int | None
    pay_by: Annotated[
        datetime | None,
        Field(description="When the hold lapses; null once it has (confirming then flags a refund)"),
    ]


class TransferConfirmRequest(Strict):
    note: Annotated[str | None, Field(max_length=500)] = None


class TransferRejectRequest(Strict):
    note: Annotated[str, Field(min_length=3, max_length=500)]


class SandboxOutcomeRequest(Strict):
    outcome: PaymentStatus = PaymentStatus.succeeded


class WebhookAck(BaseModel):
    received: bool
    duplicate: bool


# contracted subscriptions
Weekday = Annotated[int, Field(ge=0, le=4, description="0=Monday … 4=Friday")]


class SubscriptionScheduleOut(BaseModel):
    """The first cycle a choice of cleaner, weekdays and first visit gives. Advisory: the hold re-checks."""

    plan_id: int
    staff_id: int
    timezone: str
    starts_on: Annotated[date, Field(description="First visit; the cycle starts here")]
    ends_on: Annotated[date, Field(description="Last day of the cycle (four weeks), inclusive")]
    renews_on: Annotated[date, Field(description="Next cycle's first day: renewal and charge")]
    visit_dates: list[date]
    start_times: Annotated[list[time], Field(description="Local start times free on every visit date")]


class SubscriptionCreateRequest(Strict):
    plan_id: int
    staff_id: int
    address_id: Annotated[int, Field(description="One of the customer's saved addresses")]
    weekdays: Annotated[list[Weekday], Field(min_length=1, max_length=5)]
    starts_on: Annotated[date, Field(description="First visit; must fall on one of the weekdays")]
    visit_start: Annotated[time, Field(description="Local start time, the same for every visit")]
    accept_terms: Annotated[Literal[True], Field(description="The customer accepted the plan's terms")]

    @field_validator("weekdays")
    @classmethod
    def _distinct(cls, value: list[int]) -> list[int]:
        if len(set(value)) != len(value):
            raise ValueError("weekdays must be different")
        return sorted(value)


class SubscriptionCycleOut(Out):
    id: int
    sequence: int
    starts_on: date
    ends_on: Annotated[date, Field(description="Last day of the cycle, inclusive")]
    status: CycleStatus
    hold_expires_at: datetime | None
    price_minor: int
    currency: str
    visits: list[BookingOut]


class SubscriptionOut(Out):
    """A contracted plan with the price and terms copied when the customer accepted them."""

    id: int
    status: SubscriptionStatus
    plan_id: int
    plan_name: str
    staff_id: int
    weekdays: list[int]
    visit_start: Annotated[time, Field(description="Local start time of every visit")]
    address: Annotated[str, Field(description="Address text as it was when the plan was contracted")]
    address_id: int | None
    days_per_week: int
    visits_per_cycle: int
    visit_duration_minutes: int
    price_minor: Annotated[int, Field(description="Accepted price per cycle")]
    currency: str
    terms: Annotated[str, Field(description="Accepted terms")]
    terms_accepted_at: datetime
    created_at: datetime
    renews_on: Annotated[date | None, Field(description="Start of the next cycle while it renews")]
    renewal_notice_on: Annotated[
        date | None, Field(description="Last visit day of the paid cycle: the renewal notice goes out")
    ] = None
    next_charge_on: Annotated[
        date | None, Field(description="Business day the renewal is charged; cancel before it to stop it")
    ] = None
    payment_method: PaymentMethod
    cancelled_at: Annotated[datetime | None, Field(description="Cancelled: ends after the paid cycles")]
    ended_at: datetime | None
    end_reason: SubscriptionEndReason | None
    cycles: list[SubscriptionCycleOut]


class AdminSubscriptionOut(SubscriptionOut):
    customer_id: int
    staff_earning_minor: Annotated[int, Field(description="Accepted cleaner pay per completed visit")]


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


class EarningsSummaryOut(BaseModel):
    staff_id: int
    week_start: date
    currency: str
    earned_minor: int
    approved_minor: int
    paid_minor: int
    items: list[EarningOut]
    settlements: list[SettlementOut]


# notifications
class NotificationOut(Out):
    id: int
    category: NotificationCategory
    kind: str = Field(description="The event that caused it, e.g. booking.confirmed")
    title: str
    body: str
    data: dict[str, int] = Field(
        description="Ids of what it is about (booking_id, subscription_id, payment_id, settlement_id)"
    )
    created_at: datetime
    read_at: datetime | None


class UnreadCountOut(BaseModel):
    count: int


class NotificationPreferenceOut(BaseModel):
    category: NotificationCategory
    push_enabled: bool


class NotificationPreferenceRequest(Strict):
    push_enabled: bool


class PushDeviceRequest(Strict):
    token: Annotated[
        str,
        Field(max_length=255, pattern=r"^Expo(nent)?PushToken\[[A-Za-z0-9_-]{1,200}\]$"),
    ]
    platform: Literal["ios", "android"]
