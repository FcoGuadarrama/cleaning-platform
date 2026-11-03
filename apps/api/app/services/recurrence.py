"""Calendar-only helpers for future subscriptions. No billing rules here (cycle definition is open)."""

import calendar
from datetime import date


def weekday_occurrences(year: int, month: int, weekday: int) -> list[date]:
    """All dates in the calendar month falling on `weekday` (0=Mon … 4=Fri). May return 4 or 5 dates."""
    if not 0 <= weekday <= 4:
        raise ValueError("services run Monday to Friday")
    days = calendar.monthrange(year, month)[1]
    return [date(year, month, d) for d in range(1, days + 1) if date(year, month, d).weekday() == weekday]
