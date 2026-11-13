# WORKTREE STATE & HANDOFF LOG
- **Feature:** 011 subscription renewal, cancellation, card + SPEI (docs/tasks/011-renewal-spei.md)
- **Current Agent:** claude-code
- **Last Updated:** 2026-11-11T20:45:00Z
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
- [x] 7. Mobile: method choice + SPEI instructions (book, subscribe, visit detail), Mi suscripción renewal notice,
      next charge, pending renewal (pay by card / transfer details), cancel with in-place confirmation.
      API: GET /bookings/{id}/payment and /subscriptions/{id}/payment.
- [x] 8. Dashboard: Transferencias queue (confirm / reject, menu counter); subscription statuses (cancela al cierre,
      renovación sin pagar, terminada), payment method and next charge in the sheet.
- [x] 9. Docs (PRODUCT confirmed decisions, ADR 0010, DOMAIN 18–21, ARCHITECTURE, env example, compose
      placeholder SPEI account), stack rebuilt, local e2e OK.
- [ ] 10. Owner: visual check of the new screens (app: payment method, SPEI details, Mi suscripción; panel:
      Transferencias) — not looked at in a browser here.

## Immediate context / Handoff notes
Task 010's handoff archived to docs/tasks/010-outbox-housekeeping/handoff.md. tests/conftest.py now truncates after
each test too: an aborted run had left subscription visits that broke `downgrade base` (0005 NOT NULL); app_test
tables were dropped by hand (test schema only) to recover from half-applied downgrades. Migration 0008 was
edited before leaving the machine (added payments.charge_on); the local app DB was repaired by finishing the
failed downgrade by hand (only this task's columns) and re-upgrading; 0008→0007→0008 round trip verified.

## Verification
- 2026-11-11T20:44:00Z: pytest 97 passed; ruff/mypy/alembic check clean; contract unchanged on re-export; mobile tsc,
  dashboard vue-tsc + vitest 33 clean. Local stack e2e (scratchpad script, demo customer): SPEI visit 215 held 24 h,
  listed in /admin/transfers, confirmed by admin; plan subscription 4 blocked its cleaner in cycle 2, cancelled,
  slot then bookable (booking 220); outbox delivered booking.confirmed, subscription.cycle_confirmed,
  subscription.cancelled.
- 2026-11-11T20:18:00Z: mobile tsc clean; dashboard vue-tsc clean, vitest 33 passed, vite build ok; API test_spei 6 passed.
- 2026-11-11T19:38:00Z: pytest 97 passed (13 new since last checkpoint); ruff/mypy clean; alembic check clean; a real
  double-charge race found by the concurrent-runs test and fixed (cleaner lock before any plain read).
- 2026-11-11T18:28:00Z: pytest 84 passed (4 new); ruff/mypy clean; alembic check clean on app (0008).

## Partial work
- Operations in progress: none
- Blockers: none

## Exact next action
- Owner review (microtask 10); push/PR only with owner approval.
