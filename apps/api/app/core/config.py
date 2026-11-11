import os
from dataclasses import dataclass
from functools import lru_cache
from zoneinfo import ZoneInfo


@dataclass(frozen=True)
class Settings:
    database_url: str
    business_tz: ZoneInfo
    hold_ttl_minutes: int
    hold_sweep_interval_seconds: float
    outbox_dispatch_interval_seconds: float
    housekeeping_interval_seconds: float
    idempotency_key_ttl_hours: int
    outbox_retention_days: int
    notification_channel: str
    renewal_interval_seconds: float
    spei_hold_hours: int
    spei_clabe: str
    spei_bank: str
    spei_beneficiary: str
    sandbox_renewal_outcome: str
    travel_buffer_minutes: int
    workday_start_hour: int
    workday_end_hour: int
    slot_step_minutes: int
    token_ttl_hours: int
    gps_low_accuracy_m: float
    max_addresses_per_customer: int
    subscription_start_window_days: int
    payment_provider: str
    sandbox_webhook_secret: str


def _int(name: str, default: int) -> int:
    return int(os.environ.get(name, default))


@lru_cache
def get_settings() -> Settings:
    provider = os.environ.get("PAYMENT_PROVIDER", "sandbox")
    if provider != "sandbox":
        raise RuntimeError("Only the sandbox payment provider is enabled until the provider decision is made")
    channel = os.environ.get("NOTIFICATION_CHANNEL", "log")
    if channel != "log":
        raise RuntimeError("Only the log notification channel is enabled until the channel decision is made")
    return Settings(
        database_url=os.environ["DATABASE_URL"],
        business_tz=ZoneInfo(os.environ.get("BUSINESS_TZ", "America/Mexico_City")),
        hold_ttl_minutes=_int("HOLD_TTL_MINUTES", 15),
        hold_sweep_interval_seconds=float(os.environ.get("HOLD_SWEEP_INTERVAL_SECONDS", "30")),
        outbox_dispatch_interval_seconds=float(os.environ.get("OUTBOX_DISPATCH_INTERVAL_SECONDS", "5")),
        housekeeping_interval_seconds=float(os.environ.get("HOUSEKEEPING_INTERVAL_SECONDS", "3600")),
        idempotency_key_ttl_hours=_int("IDEMPOTENCY_KEY_TTL_HOURS", 24),
        outbox_retention_days=_int("OUTBOX_RETENTION_DAYS", 7),
        notification_channel=channel,
        renewal_interval_seconds=float(os.environ.get("RENEWAL_INTERVAL_SECONDS", "900")),
        spei_hold_hours=_int("SPEI_HOLD_HOURS", 24),
        # Unset until the business account exists: SPEI checkout answers 409 spei_unavailable without them.
        spei_clabe=os.environ.get("SPEI_CLABE", ""),
        spei_bank=os.environ.get("SPEI_BANK", ""),
        spei_beneficiary=os.environ.get("SPEI_BENEFICIARY", ""),
        sandbox_renewal_outcome=os.environ.get("SANDBOX_RENEWAL_OUTCOME", "succeeded"),
        travel_buffer_minutes=_int("TRAVEL_BUFFER_MINUTES", 60),
        workday_start_hour=_int("WORKDAY_START_HOUR", 8),
        workday_end_hour=_int("WORKDAY_END_HOUR", 18),
        slot_step_minutes=_int("SLOT_STEP_MINUTES", 30),
        token_ttl_hours=_int("TOKEN_TTL_HOURS", 24 * 14),
        gps_low_accuracy_m=float(os.environ.get("GPS_LOW_ACCURACY_M", "100")),
        max_addresses_per_customer=_int("MAX_ADDRESSES_PER_CUSTOMER", 10),
        subscription_start_window_days=_int("SUBSCRIPTION_START_WINDOW_DAYS", 28),
        payment_provider=provider,
        sandbox_webhook_secret=os.environ["SANDBOX_WEBHOOK_SECRET"],
    )
