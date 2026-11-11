# Task 009 — Replayable check-in/out, non-blocking hold sweeper

- **Owner:** claude-code · **Branch:** feature/attendance-replay-hold-sweeper (from feature/idempotency-lock-retry 19844f9)
- **Contracts:** docs/contracts/openapi.json — descriptions only (check-in, check-out, admin manual attendance
  document the replay). No migration. New setting `HOLD_SWEEP_INTERVAL_SECONDS` (default 30, 0 = off).
- **ADR:** 0008. **Invariants:** DOMAIN 15–16.

## Problem (owner, 2026-11-11: items 2 and 4 of the concurrency review)
2. A check-in/check-out whose response was lost could not be retried: the booking had moved on, so the retry got
   409 `invalid_booking_state` and the staff member was told to call admin.
4. `expire_holds` ran on every read with a range `FOR UPDATE` and a range `UPDATE`: a `GET` could wait on a payment
   in flight and its next-key locks could stall a concurrent hold creation.
- Found on the way: task 008's `Idempotency-Key` header was missing from CORS `allow_headers`, so the Expo web app
  (another origin) failed the preflight (400) and could not create a hold. Fixed here.

## Design
- Attendance: under the booking lock, an existing (booking, kind) record is returned when the caller recorded it,
  409 `attendance_exists` otherwise. The body is not compared (the app re-captures GPS on every tap).
- `expire_holds`: plain read of candidate ids, then lock by primary key with `SKIP LOCKED`, re-check, expire.
  Cycles before visits; visits of a skipped cycle are skipped.
- `app.jobs.sweep_holds_forever` started by the FastAPI lifespan. Reads keep calling `expire_holds` (cheap now).
- Mobile: the offline notice now says to retry with signal; the success notice reads the stored capture.

## Acceptance
- tests/test_attendance_replay.py (4), tests/test_hold_sweep.py (3), CORS preflight test in tests/test_idempotency.py.
- The new tests fail against the previous code (409 on replays; the sweep waits on the lock until the timeout).
