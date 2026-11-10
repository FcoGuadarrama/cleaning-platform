# Task 007 — Contracting a subscription (sandbox checkout)

- **Owner:** claude-code · **Branch:** feature/contratar-suscripcion (from feature/suscripciones 0222386)
- **Contracts:** docs/contracts/openapi.json changed (5 customer endpoints, 2 admin endpoints, new schemas;
  `BookingOut.offering_id` and `PaymentOut.booking_id` are now nullable). Client regenerated. Migration 0004.

## Problem (owner, 2026-11-10)
The customer picks a plan, a cleaner, an address and the weekdays; reviews every included date; pays in sandbox;
and can see the subscription and its visits. Admin can see contracted subscriptions.

## Decisions taken with the owner (2026-11-10)
- The cycle starts with the first visit, not with the payment.
- A cycle is four weeks: if the customer picks Monday, the four Mondays from the first visit are theirs. It renews
  (and will be charged) on the same weekday right after: the first day of the next four weeks. A fifth occurrence
  never happens inside a cycle.
- If the assigned cleaner cannot cover a visit of the next cycle, another cleaner covers it provisionally
  (applies to renewal; not built in this task).

## Defaults used (reversible, see docs/PRODUCT.md proposals)
- One start time for every visit of the subscription (local business time).
- The first visit can be at most `SUBSCRIPTION_START_WINDOW_DAYS` (28) days ahead.
- The checkout hold uses the existing `HOLD_TTL_MINUTES` (15).

## Model
- `subscriptions`: customer, cleaner, plan version, weekdays, start time, address text + id, and a copy of the plan
  as accepted (name, days, visits, duration, price, cleaner pay, currency, terms, `terms_accepted_at`).
  Status `held → active`, `held → expired`.
- `subscription_cycles`: sequence, `starts_on`, `ends_on` (inclusive), price, status `held → confirmed | expired`,
  `hold_expires_at`.
- Visits are `bookings` with `subscription_cycle_id` (no offering, `price_minor` 0, cleaner pay copied from the plan),
  so overlap checks, attendance, earnings and settlements are the existing ones.
- `payments` pay either a booking or a cycle (CHECK `ck_payments_one_target`).

## API
- `GET /subscription-plans/{id}/schedule?staff_id&starts_on&weekdays=..` → first-cycle dates, `ends_on`,
  `renews_on`, and start times free on **every** date (advisory).
- `POST /subscriptions` (`accept_terms: true`) → one transaction under the cleaner's row lock: validates the choice,
  checks every visit (travel buffer included) and holds subscription + cycle + visits. 409 `visits_unavailable` with
  `details.dates`. 400: `weekdays_mismatch`, `start_not_on_weekday`, `start_in_past`, `start_too_far`,
  `outside_working_hours`. Hidden/superseded plan → 404.
- `POST /subscriptions/{id}/checkout` → sandbox payment for the held cycle (reuses a pending one).
- Webhook success: locks payment → cycle → visits → subscription; confirms all at once if the hold is still valid,
  otherwise flags the payment `needs_refund`.
- `expire_holds` also expires lapsed cycles and first-cycle subscriptions; every update re-checks `held`.
- `GET /subscriptions`, `GET /subscriptions/{id}` (customer, own only); `GET /admin/subscriptions[/{id}]`
  (adds `customer_id`, `staff_earning_minor`).
- `GET /bookings`: subscription visits that expired are hidden for everyone; held ones are hidden for customers
  (they see them under the subscription).
- Audited: `subscription.hold_created`, `subscription.cycle_confirmed`, plus the existing payment events.

## UI
- Mobile: plan detail → "Contratar este plan" → `subscribe.tsx` (1 cleaner · 2 weekdays, first visit among the next
  dates on those weekdays, a time free on every visit · 3 review: every date, cycle range, renewal day, address,
  terms checkbox, total) → sandbox pay → "Tu plan está activo" → "Mi suscripción" (Cuenta). A lost hold sends the
  customer back to step 2 with the reason. Plan visits show "Visita de tu plan" / "Incluida en tu plan".
- Dashboard › Suscripciones: tabs Planes · Contratadas. Contratadas lists subscriptions (Activas, Pago pendiente,
  Apartados vencidos, Todas); the sheet shows what the customer accepted, the cycle and its visits (link to Reservas)
  and the accepted terms. Bookings show plan visits as "Visita de plan mensual · En plan"; sales and average ticket
  leave them out (bookings and hours count them).

## Out of scope
Renewal and its charge, provisional replacement cleaner, pause/cancel, refunds execution, Stripe, subscription
revenue on the dashboard overview (sales there are single visits only).

## Acceptance
1. API: pytest, ruff, mypy pass; contract exported; client regenerated; `pnpm check:drift` clean.
2. Dashboard: typecheck, vitest, build. Mobile: tsc clean.
3. Browser: contract a plan end to end in the app (sandbox), see "Mi suscripción" and the visits; see it in the
   dashboard.
