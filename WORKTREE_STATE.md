# WORKTREE STATE & HANDOFF LOG
- **Feature:** 011 subscription renewal, cancellation, card + SPEI (docs/tasks/011-renewal-spei.md)
- **Current Agent:** claude-code
- **Last Updated:** 2026-11-11T19:40:00Z
- **Branch / Worktree:** feature/renewal-spei (main worktree), from feature/outbox-housekeeping f074e68
- **Base SHA:** f074e68
- **Contract Version:** docs/contracts/openapi.json exported (checkout method, cancel, admin transfers); client regenerated
- **Database:** compose project cp_f4bbf0f0 (app at alembic 0008; app_test rebuilt by the suite)

## Microtask checklist
- [x] 1. Model + migration 0008 (payment method/review, subscription payment_method/cancelled_at/ended_at/end_reason);
      settings (renewal interval, SPEI hold/account, sandbox renewal outcome); recurrence business-day helpers.
- [x] 2. Commitments (`app/services/commitments.py`): subscriptions project weekly visits; single bookings,
      availability and contracting check them (tests/test_commitments.py, 4).
- [x] 3. Payments: checkout `{method}`, SPEI 24 h hold + instructions, admin confirm/reject transfer; lock order
      payment → subscription → cycle → visits (also in expire_holds). tests/test_spei.py (6).
- [x] 4. Cancellation endpoint (`POST /subscriptions/{id}/cancel`).
- [x] 5. Renewal job `app/services/renewals.py` (notice, charge, daily retry/reminder, end unpaid/cancelled);
      `Payment.charge_on` (one card attempt per business day). tests/test_renewals.py (7) incl. concurrent runs.
- [x] 6. Contract + client regen (mobile/dashboard typecheck pending their microtasks).
- [ ] 7. Mobile: method choice, SPEI instructions, Mi suscripción renewal/cancel/pay now.
- [ ] 8. Dashboard: Transferencias queue; subscription statuses.
- [ ] 9. Docs (PRODUCT confirmed decisions, ADR 0010, DOMAIN), rebuild, e2e.

## Immediate context / Handoff notes
Task 010's handoff archived to docs/tasks/010-outbox-housekeeping/handoff.md. tests/conftest.py now truncates after
each test too: an aborted run had left subscription visits that broke `downgrade base` (0005 NOT NULL); app_test
tables were dropped by hand (test schema only) to recover from half-applied downgrades. Migration 0008 was
edited before leaving the machine (added payments.charge_on); the local app DB was repaired by finishing the
failed downgrade by hand (only this task's columns) and re-upgrading; 0008→0007→0008 round trip verified.

## Verification
- 2026-11-11T19:38:00Z: pytest 97 passed (13 new since last checkpoint); ruff/mypy clean; alembic check clean; a real
  double-charge race found by the concurrent-runs test and fixed (cleaner lock before any plain read).
- 2026-11-11T18:28:00Z: pytest 84 passed (4 new); ruff/mypy clean; alembic check clean on app (0008).

## Partial work
- Operations in progress: none
- Blockers: none

## Exact next action
- Microtask 7 (mobile), then 8 (dashboard).
