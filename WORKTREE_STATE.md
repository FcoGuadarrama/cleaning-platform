# WORKTREE STATE & HANDOFF LOG
- **Feature:** 004-admin-bookings (bookings in the admin dashboard)
- **Current Agent:** claude-code
- **Last Updated:** 2026-11-09T20:05:42Z
- **Branch / Worktree:** feature/reservas (current worktree)
- **Base SHA:** 94236a9
- **Contract Version:** docs/contracts/openapi.json sha256 7048fafa087ab3ba53dc21951571190d6855dce9dd7fd6b4990a37202cea22dd
- **Database:** compose project cp_5f97f191 (mysql only; seeded with app.seed_demo; test bookings 202 cancelled, 203 held)

## Microtask checklist
- [x] 1. API: GET /admin/customers, POST /admin/bookings/{id}/cancel, expire holds on booking reads; tests.
- [x] 2. Contract exported, api-client regenerated.
- [x] 3. Dashboard: customer column/detail + search, cancel dialog, 30 s background refresh while visible.
- [x] 4. Owner's main stack (~/projects/cleaning-platform, cp_f4bbf0f0) seeded with app.seed_demo.

## Immediate context / Handoff notes
See docs/tasks/004-admin-bookings.md. Previous handoff (app-design) archived to docs/tasks/app-design/handoff.md.
Refund execution and late-cancel compensation stay open; cancel only flags payments.needs_refund.

## Verification
- pytest 27 passed (MySQL cp_5f97f191); ruff check/format clean; mypy clean.
- dashboard vitest 13 passed; vite build OK; pnpm -r typecheck clean.
- Browser (local API + vite on this branch): customer column and detail, cancel of paid booking 202 → "Cancelada"
  + refund toast, new booking 203 appeared within 30 s without reload; no console errors.
- Pending tests: mobile app not re-checked (its code is unchanged; held→expired now shows "Expirada").

## Partial work
- None.

## Exact next action
- Owner review; push / PR need owner approval.
