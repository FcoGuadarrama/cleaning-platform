# WORKTREE STATE & HANDOFF LOG
- **Feature:** 011 subscription renewal, cancellation, card + SPEI (docs/tasks/011-renewal-spei.md)
- **Current Agent:** claude-code
- **Last Updated:** 2026-11-11T18:30:00Z
- **Branch / Worktree:** feature/renewal-spei (main worktree), from feature/outbox-housekeeping f074e68
- **Base SHA:** f074e68
- **Contract Version:** not exported yet in this task
- **Database:** compose project cp_f4bbf0f0 (app at alembic 0008; app_test rebuilt by the suite)

## Microtask checklist
- [x] 1. Model + migration 0008 (payment method/review, subscription payment_method/cancelled_at/ended_at/end_reason);
      settings (renewal interval, SPEI hold/account, sandbox renewal outcome); recurrence business-day helpers.
- [x] 2. Commitments (`app/services/commitments.py`): subscriptions project weekly visits; single bookings,
      availability and contracting check them (tests/test_commitments.py, 4).
- [ ] 3. Payments: checkout `{method}`, SPEI 24 h hold + instructions, admin confirm/reject transfer; lock order
      payment → subscription → cycle → visits (also in expire_holds).
- [ ] 4. Cancellation endpoint.
- [ ] 5. Renewal job (notice, charge, daily retry/reminder, end unpaid/cancelled).
- [ ] 6. Contract + client regen.
- [ ] 7. Mobile: method choice, SPEI instructions, Mi suscripción renewal/cancel/pay now.
- [ ] 8. Dashboard: Transferencias queue; subscription statuses.
- [ ] 9. Docs (PRODUCT confirmed decisions, ADR 0010, DOMAIN), rebuild, e2e.

## Immediate context / Handoff notes
Task 010's handoff archived to docs/tasks/010-outbox-housekeeping/handoff.md. tests/conftest.py now truncates after
each test too: an aborted run had left subscription visits that broke `downgrade base` (0005 NOT NULL); app_test
tables were dropped once by hand (test schema only) to recover from the half-applied downgrade.

## Verification
- 2026-11-11T18:28:00Z: pytest 84 passed (4 new); ruff/mypy clean; alembic check clean on app (0008).

## Partial work
- Operations in progress: none
- Blockers: none

## Exact next action
- Microtask 3.
