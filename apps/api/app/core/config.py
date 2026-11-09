import os
from dataclasses import dataclass
from functools import lru_cache
from zoneinfo import ZoneInfo


@dataclass(frozen=True)
class Settings:
    database_url: str
    business_tz: ZoneInfo
    hold_ttl_minutes: int
    travel_buffer_minutes: int
    workday_start_hour: int
    workday_end_hour: int
    slot_step_minutes: int
    token_ttl_hours: int
    gps_low_accuracy_m: float
    max_addresses_per_customer: int
    payment_provider: str
    sandbox_webhook_secret: str


def _int(name: str, default: int) -> int:
    return int(os.environ.get(name, default))


@lru_cache
def get_settings() -> Settings:
    provider = os.environ.get("PAYMENT_PROVIDER", "sandbox")
    if provider != "sandbox":
        raise RuntimeError("Only the sandbox payment provider is enabled until the provider decision is made")
    return Settings(
        database_url=os.environ["DATABASE_URL"],
        business_tz=ZoneInfo(os.environ.get("BUSINESS_TZ", "America/Mexico_City")),
        hold_ttl_minutes=_int("HOLD_TTL_MINUTES", 15),
        travel_buffer_minutes=_int("TRAVEL_BUFFER_MINUTES", 60),
        workday_start_hour=_int("WORKDAY_START_HOUR", 8),
        workday_end_hour=_int("WORKDAY_END_HOUR", 18),
        slot_step_minutes=_int("SLOT_STEP_MINUTES", 30),
        token_ttl_hours=_int("TOKEN_TTL_HOURS", 24 * 14),
        gps_low_accuracy_m=float(os.environ.get("GPS_LOW_ACCURACY_M", "100")),
        max_addresses_per_customer=_int("MAX_ADDRESSES_PER_CUSTOMER", 10),
        payment_provider=provider,
        sandbox_webhook_secret=os.environ["SANDBOX_WEBHOOK_SECRET"],
    )
