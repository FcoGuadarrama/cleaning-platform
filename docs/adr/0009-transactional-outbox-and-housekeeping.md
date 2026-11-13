# ADR 0009 — Transactional outbox and housekeeping (2026-11-11, accepted)

**Context.** Notifications (email, push, WhatsApp…) are coming, but the channel is an open decision
(docs/PRODUCT.md, decision 6). Sending from inside a request either notifies about a change that later rolls back
or loses the notification when the process dies after the commit. Idempotency keys (ADR 0007) were never deleted.

**Outbox.** `outbox.publish(session, topic, subject_id, **ids)` adds an `outbox_messages` row in the caller's
transaction, next to the audit record, at eight transitions: `booking.confirmed`, `booking.cancelled`,
`booking.completed`, `subscription.cycle_confirmed`, `payment.failed`, `payment.needs_refund`,
`attendance.exception_opened`, `settlement.paid`. `key = topic:subject_id` is unique, so an event exists once; it is
also what a receiver passes to its provider as an idempotency key. The payload holds ids only: no personal data in
the table or the logs, and the sender reads current state when it sends. Choosing recipients and wording is the
channel decision, not this one.

**Dispatch.** `outbox.dispatch` claims up to 50 due messages (plain read of candidates, then a primary-key lock with
`SKIP LOCKED`, as in ADR 0008), leases them by moving `available_at` 5 minutes ahead, and commits before delivering,
so no lock is held during network I/O. Each delivery is capped at 30 s. Success marks `sent`; failure backs off
exponentially (30 s doubling, capped at 1 h) and after 8 attempts marks `dead`, logged as an error and kept. A
claim whose lease lapsed (the process died mid-delivery) is delivered again by another dispatcher, and the stale
claim cannot overwrite the result (its failure is recorded only while `attempts` still matches). Delivery is
therefore at least once and unordered. The only channel is `log` (`NOTIFICATION_CHANNEL`, any other value refuses to
start), like the sandbox payment provider.

**Housekeeping.** Hourly (`HOUSEKEEPING_INTERVAL_SECONDS`): delete idempotency keys older than
`IDEMPOTENCY_KEY_TTL_HOURS` (24, far beyond any client retry) and `sent` messages older than `OUTBOX_RETENTION_DAYS`
(7). Deletes run in batches of 500 by primary key in short transactions. `dead` and `pending` messages are kept.
Migration 0007 adds the table and an index on `idempotency_keys.created_at`.

**Jobs.** `app.jobs` runs the hold sweep, outbox dispatch (every 5 s) and housekeeping in each API process from the
FastAPI lifespan; an interval of 0 turns a job off. All three are safe to run concurrently in several processes.

**Open.** No admin view of `dead` messages yet; inspect the table. Superseded in part by ADR 0011: the `log` channel
and `NOTIFICATION_CHANNEL` are gone; `dispatch` takes a delivery function (inbox fan-out + Expo push).
