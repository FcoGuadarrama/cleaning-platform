# WORKTREE STATE & HANDOFF LOG
- **Feature:** 005-admin-bookings (bookings in the admin dashboard, docs/tasks/005-admin-bookings.md)
- **Current Agent:** claude-code
- **Last Updated:** 2026-11-09T20:26:03Z
- **Branch / Worktree:** feature/reservas (current worktree), merged with origin/main b3fc796 (Mis domicilios)
- **Base SHA:** 94236a9
- **Contract Version:** docs/contracts/openapi.json sha256 f3f6f4a24d65239f0989b6fa4f0f74d6c229da04ddef5b8568b7ed1ddeccb794 (admin customers + cancel on top of /addresses)
- **Database:** compose project cp_5f97f191 (app + app_test at alembic 0002; app seeded with app.seed_demo)

## Microtask checklist
- [x] 1. API: GET /admin/customers, POST /admin/bookings/{id}/cancel, expire holds on booking reads; tests.
- [x] 2. Contract exported, api-client regenerated.
- [x] 3. Dashboard: customer column/detail + search, cancel dialog, 30 s background refresh while visible.
- [x] 4. Owner's main stack (~/projects/cleaning-platform, cp_f4bbf0f0) seeded with app.seed_demo.
- [x] 5. Merged origin/main (004-mis-domicilios): task renumbered 004 → 005, scheduling imports combined,
      contract and client regenerated after the merge, dashboard fixture gained address_id.

## Immediate context / Handoff notes
Refund execution and late-cancel compensation stay open; cancel only flags payments.needs_refund.
Previous handoffs: docs/tasks/app-design/handoff.md; Mis domicilios handoff is in git history (b3fc796).

## Verification
- After merge (2026-11-09T20:26:03Z): pytest 35 passed (MySQL cp_5f97f191); ruff check/format clean; mypy
  clean; pnpm -r typecheck clean; dashboard vitest 13 passed; dashboard build OK.
- Before merge: browser check of customer column, cancel (refund toast) and 30 s live refresh; no console errors.
- Pending tests: browser not re-run after the merge (no UI file conflicts).

## Partial work
- None.

## Exact next action
- Owner review of PR feature/reservas.
