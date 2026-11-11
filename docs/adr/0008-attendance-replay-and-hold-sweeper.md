# ADR 0008 — Replayable attendance and a non-blocking hold sweeper (2026-11-11, accepted)

**Context.** Items 2 and 4 of the concurrency review. A check-in or check-out whose response was lost could not be
retried: the booking had already moved on, so the retry answered 409 `invalid_booking_state`. Lapsed holds were
released only by `expire_holds`, called at the start of every read that reports hold status. It locked every lapsed
cycle with a range `FOR UPDATE` and expired bookings with a range `UPDATE`, so a plain `GET` could wait on a payment
in flight (or time out into 503), and its next-key locks could stall a concurrent hold creation.

**Attendance replay.** A booking has at most one check-in and one check-out (`UNIQUE(booking_id, kind)`). Under the
booking's row lock, an existing record of the same kind is returned (201) when the caller recorded it; recorded by
someone else (staff vs. admin manual) it is 409 `attendance_exists`. The request body is not compared: the app
captures GPS again on every tap, so a retry never repeats it, and the first capture wins. No `Idempotency-Key` is
needed because the operation has a natural key.

**Hold sweep.** `expire_holds` reads candidate ids with a plain consistent read (no locks; nothing else happens when
nothing has lapsed), then locks them by primary key with `FOR UPDATE SKIP LOCKED` and re-checks `held` and the
expiry. A row another transaction holds is left for the next sweep. Cycles are locked before their visits (the
order of `payments._confirm_cycle`), and the visits of a cycle that was skipped are skipped too, so a cycle being
confirmed never loses its visits. Only the first cycle's subscription update can still wait (by primary key, short).

**Sweeper.** `app.jobs.sweep_holds_forever` runs in each API process from the FastAPI lifespan, every
`HOLD_SWEEP_INTERVAL_SECONDS` (default 30, 0 turns it off). Several processes may sweep at once; SKIP LOCKED keeps
them apart, so no leader election or `GET_LOCK` is needed. A failed sweep is logged and the next one retries. Reads
still call `expire_holds`, so a lapsed hold never shows as `held`; availability never depended on the sweep
(`_blocking_clause` ignores lapsed holds).

**Consequences.** A hold whose row a writer has locked can show as `held` past its expiry until that writer
commits, then the writer's own validity check decides. Moving the sweep out of the request path entirely (reads
computing the effective status) stays open if read traffic makes even the candidate read matter.
