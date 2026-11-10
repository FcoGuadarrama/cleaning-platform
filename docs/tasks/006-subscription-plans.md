# Task 006 — Subscription plans catalog

- **Owner:** claude-code · **Branch:** feature/suscripciones · **Base SHA:** ab48e83
- **Contracts:** docs/contracts/openapi.json changed (four admin endpoints, one catalog endpoint, four schemas);
  client regenerated.

## Problem (owner, 2026-11-10: "sacar el módulo de suscripciones, los puedo configurar en el dashboard y se mostrarán a los clientes")
Admin configures monthly plans in the dashboard; customers see them in the app. Payment (Stripe) comes later.

## Decisions taken with the owner
- Monthly cycle, fixed price, four visits per chosen weekday; a fifth occurrence in the month adds no visit
  (closes open decision 2 in docs/PRODUCT.md).
- Each plan sets 1–5 weekdays per week; the customer will choose which ones.

## API
- `GET /subscription-plans` (any signed-in user) → `SubscriptionPlanOut[]`: visible plans, no cleaner pay.
- `GET /admin/subscription-plans` → every version (`AdminSubscriptionPlanOut`, includes `replaces_id`, `is_active`).
- `POST /admin/subscription-plans` creates; `POST /admin/subscription-plans/{id}/versions` creates a version that
  replaces `id`, inherits its visibility and hides it; `PATCH /admin/subscription-plans/{id}` `{is_active}` shows or
  hides. Superseded versions answer 409 `plan_superseded`. Writes lock the plan row; `replaces_id` is unique.
- Audited: `subscription_plan.created|revised|shown|hidden`. Migration 0003.

## UI
- Dashboard › Suscripciones: plan list, detail sheet (customer preview, monthly numbers, terms, previous versions),
  editor sheet with live numbers and customer preview. Hide has a Deshacer toast. Toasts stay clickable while a
  sheet is open (global fix in style.css).
- Mobile: tab bar Inicio · Planes · Visitas · Cuenta. Inicio shows status only (next visit, or an empty card that
  points to Planes first and to a single visit second). Planes lists the plans, then single services under
  "¿Solo una vez?". Plan detail shows terms; "Contratar este plan" is Próximamente. "Mi suscripción" in Cuenta stays
  Próximamente (no purchases exist).

## Out of scope
Purchase, accepted-terms snapshot per purchase, cycles, renewal, Stripe checkout, weekday/cleaner selection.

## Acceptance
1. API: pytest, ruff, mypy app pass; contract exported; client regenerated; `pnpm check:drift` clean.
2. Dashboard: typecheck, vitest, build pass. Mobile: tsc clean.
3. Browser: create plan, save a new version (history shows v1), hide + Deshacer, customer sees the latest version.
