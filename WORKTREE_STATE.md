# WORKTREE STATE & HANDOFF LOG
- **Feature:** contracting a subscription with sandbox checkout (docs/tasks/007-subscription-checkout.md)
- **Current Agent:** claude-code
- **Last Updated:** 2026-11-10T21:47:24Z
- **Branch / Worktree:** feature/contratar-suscripcion (main worktree), from feature/suscripciones 0222386
- **Base SHA:** 0222386
- **Contract Version:** docs/contracts/openapi.json sha256 c71d616a02e555d34e669813090f0422129cc1fcf4c1708806196fafaf8a9a4c
- **Database:** compose project cp_f4bbf0f0 (app_test at alembic 0004; app still at 0003 until the api container restarts)

## Microtask checklist
- [x] 1. API: models + migration 0004, schedule/hold/checkout/confirm/expire, customer + admin endpoints, tests, contract + client.
- [ ] 2. Mobile: contracting flow from plan detail (cleaner, address, weekdays, first visit, time, review, pay), Mi suscripción.
- [ ] 3. Dashboard: contracted subscriptions list + detail.
- [ ] 4. Docs (PRODUCT, DOMAIN, STATE), browser check end to end.

## Immediate context / Handoff notes
Owner decided 2026-11-10: cycle starts with the first visit; four weeks per cycle (four visits per chosen weekday);
renews on the same weekday right after; next-cycle cleaner unavailability → provisional replacement (renewal, later).
Visits are bookings with subscription_cycle_id and price 0; the cycle carries the charge. See task 007.
feature/suscripciones (plans catalog) is still awaiting owner review; this branch builds on it.

## Verification
- 2026-11-10T21:47:24Z: pytest 50 passed; ruff + format + mypy app clean; alembic upgrade/downgrade/upgrade + check clean on app_test.

## Partial work
- None.

## Exact next action
- Mobile contracting flow (apps/mobile-client/app/(customer)/plans/[id].tsx → new subscribe screen).
