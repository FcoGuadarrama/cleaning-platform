# Task 010 — Transactional outbox, housekeeping of idempotency keys

- **Owner:** claude-code · **Branch:** feature/outbox-housekeeping (from feature/attendance-replay-hold-sweeper c6e8c4b)
- **Contracts:** no API change (openapi.json unchanged). Migration 0007 (`outbox_messages`, index on
  `idempotency_keys.created_at`). New settings: `OUTBOX_DISPATCH_INTERVAL_SECONDS` (5), `HOUSEKEEPING_INTERVAL_SECONDS`
  (3600), `IDEMPOTENCY_KEY_TTL_HOURS` (24), `OUTBOX_RETENTION_DAYS` (7), `NOTIFICATION_CHANNEL` (log only).
- **ADR:** 0009. **Invariants:** DOMAIN 17.

## Problem (owner, 2026-11-11)
- Idempotency keys were never deleted.
- Notifications need a transactional outbox before any channel exists, so nothing is sent for a rolled-back change
  and nothing is lost when a process dies after commit.

## Design
- `app/services/outbox.py`: `publish` in the caller's transaction at eight transitions; `dispatch` claims with
  SKIP LOCKED, leases, delivers outside the transaction, backs off, dead-letters after 8 attempts.
- `app/services/housekeeping.py`: batched deletes of expired keys and old `sent` messages.
- `app/jobs.py`: hold sweep, outbox dispatch and housekeeping started by the FastAPI lifespan.

## Acceptance
- tests/test_outbox.py (7): events with their change; rollback publishes nothing; delivery once; backoff then dead;
  concurrent dispatchers deliver each message once; a lapsed lease is redelivered and the stale claim cannot undo it;
  a check-in replay publishes one exception event.
- tests/test_housekeeping.py (3): expired keys deleted; only old `sent` messages deleted; batched deletes.
