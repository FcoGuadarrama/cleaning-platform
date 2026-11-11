# WORKTREE STATE & HANDOFF LOG
- **Feature:** 009 replayable check-in/out, non-blocking hold sweeper (docs/tasks/009-attendance-replay-hold-sweeper.md)
- **Current Agent:** claude-code
- **Last Updated:** 2026-11-11T16:55:00Z
- **Branch / Worktree:** feature/attendance-replay-hold-sweeper (main worktree), from feature/idempotency-lock-retry 19844f9
- **Base SHA:** 19844f9
- **Contract Version:** docs/contracts/openapi.json (descriptions only changed)
- **Database:** compose project cp_f4bbf0f0 (app + app_test at alembic 0006; no migration in this task)

## Microtask checklist
- [x] 1. API: CORS allows `Idempotency-Key` (task 008 regression: Expo web preflight answered 400).
- [x] 2. API: check-in/out and admin manual attendance return the stored record on a replay by the same user;
      409 `attendance_exists` when someone else recorded it. Broad IntegrityError catch removed.
- [x] 3. API: `expire_holds` = plain candidate read + PK lock with SKIP LOCKED; background sweeper in the lifespan
      (`HOLD_SWEEP_INTERVAL_SECONDS`, default 30).
- [x] 4. Contract exported, api-client regenerated; mobile offline notice invites a retry.
- [x] 5. Docs: ADR 0008 (+ CORS note in 0007), ARCHITECTURE, DOMAIN 15–16, task 009, .env.prod.example.
- [ ] 6. Rebuild the local stack and check the preflight against the running API.
- [ ] 7. Owner: retry a check-in with no signal in the app; try a purchase from Expo web.

## Immediate context / Handoff notes
Task 008's handoff archived to docs/tasks/008-idempotency-lock-retry/handoff.md (its microtask 7, a purchase on a
flaky connection, is still open). pnpm is not on PATH in this shell: the client was regenerated with
packages/api-client/node_modules/.bin/openapi-typescript (same args as the generate script).

## Verification
- 2026-11-11T16:50:00Z: pytest 70 passed (8 new); the new tests fail against the previous code (checked by swapping
  the old service files in temporarily). ruff check/format clean; mypy app clean; alembic check clean.
  mobile tsc, api-client tsc, dashboard vue-tsc clean; dashboard vitest 30 passed.

## Partial work
- Modified or new files: see git status.
- Operations in progress: none
- Blockers: none

## Exact next action
- Microtask 6: rebuild api/web/mobile containers (volumes kept) and re-run the CORS preflight with curl.
