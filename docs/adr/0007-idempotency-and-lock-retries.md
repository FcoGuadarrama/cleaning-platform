# ADR 0007 — Idempotent creates and lock-conflict retries (2026-11-11, accepted)

**Context.** ADR 0002 keeps two customers from holding the same cleaner at the same time. It did not cover a
customer retrying their own request: a hold created by an attempt whose response was lost made the retry answer
409 against the customer's own hold. InnoDB deadlocks and lock-wait timeouts reached clients as 500.

**Idempotency-Key.** `POST /bookings` and `POST /subscriptions` accept an optional `Idempotency-Key` header
(≤ 64 chars, scoped per user: `UNIQUE(user_id, key)`). The create claims the key first, in its own transaction,
under a savepoint. Same key and body → the first attempt's resource (201). Same key, different body → 409
`idempotency_key_reused`. A failed attempt rolls its key back, so retrying it runs again. Concurrent attempts wait
on the unique index; replays read the row with a shared lock (`FOR SHARE`), which never deadlocks among
themselves. Keys are kept; pruning is a later job. The mobile app keeps one key per distinct request body and drops
it when the hold is dropped.

**Lock-conflict retries.** `app.core.db.retry_on_lock_conflict` wraps every write service whose writes are one
transaction. On MySQL 1213 (deadlock) or 1205 (lock-wait timeout) it re-runs the call up to 3 times with jitter,
then answers 503 `database_busy`. The request user is detached from the session so a rollback never expires it.
A service that is not one transaction (e.g. `simulate_outcome`) must not be wrapped. Lock order is documented
where locks are taken; `expire_holds` locks cycles before visits, like `_confirm_cycle`.

**Webhook dedupe.** Only the duplicate-key failure of the `WebhookEvent` insert (its own savepoint) means "replay".
Any other failure rolls the event back and propagates, so the provider's redelivery applies it.

**Client network failures.** `@repo/api-client` turns a request with no answer into a 503 `network_error` error
response instead of a thrown exception, so screens keep their state and can retry.
