import pytest

from app.services.recurrence import weekday_occurrences


def test_month_with_five_tuesdays_is_not_truncated() -> None:
    # December 2026 has five Tuesdays (1, 8, 15, 22, 29) — the open billing question, not silently 4.
    assert [d.day for d in weekday_occurrences(2026, 12, 1)] == [1, 8, 15, 22, 29]
    assert len(weekday_occurrences(2026, 2, 1)) == 4


def test_weekend_rejected() -> None:
    with pytest.raises(ValueError):
        weekday_occurrences(2026, 12, 5)
