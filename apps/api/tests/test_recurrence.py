from datetime import date

import pytest

from app.services.recurrence import cycle_dates, cycle_end


def test_cycle_has_four_visits_per_weekday_even_in_a_five_tuesday_month() -> None:
    # December 2026 has five Tuesdays; a cycle starting on Tue 1 Dec still takes only four of them.
    dates = cycle_dates(date(2026, 12, 1), [1])
    assert [d.isoformat() for d in dates] == ["2026-12-01", "2026-12-08", "2026-12-15", "2026-12-22"]
    assert cycle_end(date(2026, 12, 1)) == date(2026, 12, 28)


def test_cycle_starting_midweek_takes_the_next_occurrences_of_earlier_weekdays() -> None:
    # Starts Wed 18 Nov with Mon + Wed: Mondays 23 Nov … 14 Dec fall inside the four weeks.
    dates = cycle_dates(date(2026, 11, 18), [0, 2])
    assert len(dates) == 8
    assert dates[0] == date(2026, 11, 18) and dates[-1] == date(2026, 12, 14)
    assert sum(d.weekday() == 0 for d in dates) == 4


def test_weekend_rejected() -> None:
    with pytest.raises(ValueError):
        cycle_dates(date(2026, 12, 1), [5])
