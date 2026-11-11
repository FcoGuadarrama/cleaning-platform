# WORKTREE STATE & HANDOFF LOG
- **Feature:** 008 idempotent creates, lock-conflict retries, precise webhook dedupe (docs/tasks/008-idempotency-lock-retry.md)
- **Current Agent:** claude-code
- **Last Updated:** 2026-11-11T14:58:55Z
- **Branch / Worktree:** feature/idempotency-lock-retry (main worktree), from fix/panel-personal-agenda d435c29
- **Base SHA:** d435c29
- **Contract Version:** docs/contracts/openapi.json sha256 a8acac2d34d6e410a0075042d0233d681ef217ec7a34ea89c227bcb06b09e557
- **Database:** compose project cp_f4bbf0f0 (app + app_test at alembic 0006: idempotency_keys)

## Microtask checklist
- [x] 1. API: Idempotency-Key on POST /bookings and POST /subscriptions (table idempotency_keys, migration 0006).
- [x] 2. API: retry_on_lock_conflict (1213/1205, 3 attempts, then 503 database_busy) on every single-transaction
      write service; request user detached from the session; expire_holds locks cycles before visits.
- [x] 3. API: webhook dedupe only on the WebhookEvent duplicate-key insert (savepoint); other failures propagate.
- [x] 4. Contract exported, api-client schema regenerated.
- [x] 5. Mobile: per-body Idempotency-Key (src/idempotency.ts) from book.tsx and subscribe.tsx. api-client turns a
      request with no answer into 503 `network_error` (was a throw that left "Pagar" busy forever); book.tsx keeps
      the choice on network_error so "Pagar" retries with the same key; attendance keeps its offline notice.
- [x] 6. Docs: ADR 0007, ARCHITECTURE, DOMAIN invariants 13–14. Stack rebuilt, app DB at 0006.
- [ ] 7. Owner: try a purchase on a flaky connection in the app (not exercised in a browser/device here).

## Immediate context / Handoff notes
Previous feature's handoff archived to docs/tasks/panel-personal-agenda/handoff.md (its microtask 4, a visual check
as staff, is still open). pnpm is not on PATH in this shell: the client was regenerated with
packages/api-client/node_modules/.bin/openapi-typescript (same args as the generate script).

## Verification
- 2026-11-11T14:58:55Z: mobile tsc clean; api-client tsc clean; dashboard vue-tsc clean + vitest 30 passed; stack rebuilt
  (`compose up --build --detach --wait api web mobile`, volumes kept), API serves the header, `alembic current` 0006.
- 2026-11-11T14:55:53Z: pytest 62 passed (11 new: tests/test_idempotency.py, tests/test_lock_retry.py incl. a real InnoDB deadlock
  retried); ruff check/format clean; mypy app clean; alembic check on app_test clean.

## Partial work
- Modified or new files: all committed.
- Operations in progress: none
- Blockers: none

## Exact next action
- Owner review; then items 2 (idempotent check-in/out replay) and 4 (expire_holds as a periodic job) of the review.
