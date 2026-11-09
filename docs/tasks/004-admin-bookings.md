# Task 004 — Bookings in the admin dashboard

- **Owner:** claude-code · **Branch:** feature/reservas · **Base SHA:** 94236a9
- **Contracts:** docs/contracts/openapi.json changed (two admin endpoints, two schemas); client regenerated.

## Problem (owner, 2026-11-09: "las reservas no se conectan con el dashboard web")
The mobile app, API and dashboard already share one API and database per stack. The owner's main stack had no
service offerings, so no customer could book and the dashboard stayed empty. The dashboard also could only read
bookings: no customer shown, no cancel, and it loaded once per page visit.

## Scope chosen by the owner
1. Show the customer (name, email) in the bookings list and detail; refresh the panel every 30 s while visible.
2. Admin cancels `held|confirmed` bookings with a reason.
3. Expire stale holds when bookings are read (no worker).
4. Load `app.seed_demo` into the owner's main local stack (done, local only).

Out of scope (offered, not chosen): reassigning staff, creating bookings from the panel.

## API
- `GET /admin/customers` → `UserOut[]` (customers only, admin only).
- `POST /admin/bookings/{id}/cancel` `{reason}` → `{booking, refund_required}`. Locks payments then booking
  (same order as the payment webhook). Succeeded payments get `needs_refund = true`; no refund is executed and
  no cleaner compensation is computed — both are open decisions (docs/PRODUCT.md 3 and 4). Audited as
  `booking.cancelled` with reason, previous status and payment ids.
- `GET /bookings` and `GET /bookings/{id}` run `expire_holds` first, so stale `held` rows read as `expired`.
  Expired holds already did not block slots (`_blocking_clause`); this fixes their displayed status.

## Acceptance
1. API: pytest, ruff, mypy pass; contract exported and client regenerated; `pnpm check:drift` clean.
2. Dashboard: typecheck, test, build pass; loading/empty/error states kept (a failed background poll keeps the
   data on screen instead of switching to the error state).
3. Browser: a booking created as the customer appears in the panel without reload; cancel shows the refund notice.
