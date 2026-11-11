# WORKTREE STATE & HANDOFF LOG
- **Feature:** 008 idempotent creates, lock-conflict retries, precise webhook dedupe (docs/tasks/008-idempotency-lock-retry.md)
- **Current Agent:** claude-code
- **Last Updated:** 2026-11-11T14:55:53Z
- **Branch / Worktree:** feature/idempotency-lock-retry (main worktree), from fix/panel-personal-agenda d435c29
- **Base SHA:** d435c29
- **Contract Version:** docs/contracts/openapi.json sha256 a8acac2d34d6e410a0075042d0233d681ef217ec7a34ea89c227bcb06b09e557
- **Database:** compose project cp_f4bbf0f0 (app_test at alembic 0006: idempotency_keys; app DB not migrated yet)

## Microtask checklist
- [x] 1. API: Idempotency-Key on POST /bookings and POST /subscriptions (table idempotency_keys, migration 0006).
- [x] 2. API: retry_on_lock_conflict (1213/1205, 3 attempts, then 503 database_busy) on every single-transaction
      write service; request user detached from the session; expire_holds locks cycles before visits.
- [x] 3. API: webhook dedupe only on the WebhookEvent duplicate-key insert (savepoint); other failures propagate.
- [x] 4. Contract exported, api-client schema regenerated.
- [ ] 5. Mobile: send a per-body Idempotency-Key from book.tsx and subscribe.tsx.
- [ ] 6. Docs (DOMAIN invariants, ADR note), app DB migration, rebuild stack.

## Immediate context / Handoff notes
Previous feature's handoff archived to docs/tasks/panel-personal-agenda/handoff.md (its microtask 4, a visual check
as staff, is still open). pnpm is not on PATH in this shell: the client was regenerated with
packages/api-client/node_modules/.bin/openapi-typescript (same args as the generate script).

## Verification
- 2026-11-11T14:55:53Z: pytest 62 passed (11 new: tests/test_idempotency.py, tests/test_lock_retry.py incl. a real InnoDB deadlock
  retried); ruff check/format clean; mypy app clean; alembic check on app_test clean.

## Partial work
- Modified or new files: apps/api (core/db.py, deps.py, models.py, routers, services, migration 0006, tests),
  docs/contracts/openapi.json, packages/api-client/src/schema.d.ts, docs/tasks/008-*.md
- Operations in progress: none
- Blockers: none

## Exact next action
- Add apps/mobile-client/src/idempotency.ts and pass the header from book.tsx and subscribe.tsx.
