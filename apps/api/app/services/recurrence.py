"""Subscription calendar. Owner decision 2026-11-10: a cycle starts on the first visit and lasts four
weeks, so each chosen weekday falls exactly four times in it; the next cycle (the renewal) starts the day
after it ends."""

from datetime import date, timedelta

from app.models import VISITS_PER_WEEKDAY_PER_CYCLE

CYCLE_DAYS = 7 * VISITS_PER_WEEKDAY_PER_CYCLE


def cycle_end(starts_on: date) -> date:
    """Last day of the cycle that starts on `starts_on` (inclusive)."""
    return starts_on + timedelta(days=CYCLE_DAYS - 1)


def cycle_dates(starts_on: date, weekdays: list[int]) -> list[date]:
    """Visit dates of one cycle, in order: four per chosen weekday (0=Mon … 4=Fri)."""
    if not weekdays or any(not 0 <= w <= 4 for w in weekdays):
        raise ValueError("services run Monday to Friday")
    days = (starts_on + timedelta(days=i) for i in range(CYCLE_DAYS))
    return [d for d in days if d.weekday() in weekdays]
