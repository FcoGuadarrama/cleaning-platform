# Task 008 — Idempotent creates, lock-conflict retries, precise webhook dedupe

- **Owner:** claude-code · **Branch:** feature/idempotency-lock-retry (from fix/panel-personal-agenda d435c29)
- **Contracts:** docs/contracts/openapi.json — optional `Idempotency-Key` header on `POST /bookings` and
  `POST /subscriptions`; every endpoint may answer 503 `database_busy`. Migration 0006 (`idempotency_keys`).

## Problem (owner, 2026-11-11: items 1, 3, 5 of the concurrency review)
1. A retried `POST /bookings` or `POST /subscriptions` whose first response was lost found the customer's own hold
   and answered 409, leaving an unpayable hold blocking the slot for the hold TTL.
3. InnoDB deadlocks (1213) and lock-wait timeouts (1205) surfaced as 500 with no retry. `expire_holds` locked visits
   before their cycle while `payments._confirm_cycle` locks the cycle before its visits.
5. The sandbox webhook treated any `IntegrityError` while applying an event as a replay, so a real failure was
   acknowledged as a duplicate and the event was lost.

## Design
- `Idempotency-Key` (optional, ≤ 64 chars) is scoped per user: `UNIQUE(user_id, key)`. The key row is inserted
  first, inside the create's transaction, under a savepoint. A concurrent attempt with the same key waits on the
  unique index; once the first commits it reads the stored `resource_id` and returns that resource (201). If the
  first attempt failed, its key row rolled back with it and the retry runs normally. The same key with a different
  request body (fingerprint = sha256 of scope + body) is 409 `idempotency_key_reused`.
- `retry_on_lock_conflict` re-runs a whole single-transaction service call up to 3 times on 1213/1205 with jittered
  backoff, then answers 503 `database_busy`. The request's user is detached from the session so a rollback never
  expires it between attempts.
- `expire_holds` locks lapsed cycles before their visits (same order as `_confirm_cycle`).
- The webhook inserts its `WebhookEvent` under its own savepoint; only that insert's conflict means "replay".

## Mobile
`src/idempotency.ts`: one key per distinct request body. A retry of the same purchase reuses it; any change of
choice, or dropping the hold, starts a new key.
