# WORKTREE STATE & HANDOFF LOG
- **Feature:** 010 transactional outbox, housekeeping (docs/tasks/010-outbox-housekeeping.md)
- **Current Agent:** claude-code
- **Last Updated:** 2026-11-11T17:55:00Z
- **Branch / Worktree:** feature/outbox-housekeeping (main worktree), from feature/attendance-replay-hold-sweeper c6e8c4b
- **Base SHA:** c6e8c4b
- **Contract Version:** docs/contracts/openapi.json unchanged
- **Database:** compose project cp_f4bbf0f0 (app at alembic 0007: outbox_messages; app_test migrated by the suite)

## Microtask checklist
- [x] 1. Model + migration 0007 (`outbox_messages`, index on `idempotency_keys.created_at`); settings.
- [x] 2. `outbox.publish` at 8 transitions; `outbox.dispatch` (SKIP LOCKED claim, lease, backoff, dead letter).
- [x] 3. `housekeeping.prune` (keys > 24 h, sent messages > 7 days, batched).
- [x] 4. `app.jobs` runs hold sweep, outbox dispatch and housekeeping from the lifespan.
- [x] 5. Docs: ADR 0009 (+ 0007 note), ARCHITECTURE, DOMAIN glossary + invariant 17, task 010, .env.prod.example.
- [x] 6. Stack rebuilt; logging configured at startup (app INFO logs were dropped: uvicorn configures only its
      own loggers). Local paid booking 213 + admin cancel: both events delivered by the dispatcher (`sent`, 1 attempt).
- [ ] 7. Owner: choose the notification channel (PRODUCT decision 6); then a real channel replaces `_log_channel`.

## Immediate context / Handoff notes
Task 009's handoff archived to docs/tasks/009-attendance-replay-hold-sweeper/handoff.md (its microtask 7, owner
checks, is still open). pnpm is not on PATH in this shell.

## Verification
- 2026-11-11T17:55:00Z: local stack e2e (demo customer, sandbox pay, admin cancel of booking 213): API log shows
  `outbox booking.confirmed:213`, `outbox booking.cancelled:213`, `outbox dispatch: 2 rows`; rows `sent`.
  pytest test_hold_sweep 3 passed after the logging change; ruff/mypy clean.
- 2026-11-11T17:38:00Z: pytest 80 passed (10 new); ruff check/format clean; mypy app clean; alembic check clean on
  app (0007); openapi export unchanged.

## Partial work
- Modified or new files: see git status.
- Operations in progress: none
- Blockers: none

## Exact next action
- Owner: channel decision (microtask 7); push/PR only with owner approval.
