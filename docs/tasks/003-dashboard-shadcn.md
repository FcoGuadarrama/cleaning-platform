# Task 003 — Dashboard on shadcn-vue

- **Owner:** claude-code · **Branch:** feature/implementacion-shadcn · **Base SHA:** 9e3bf4e
- **Contracts:** docs/contracts/openapi.json unchanged (UI only; no API changes).

## Objective
Move `apps/web-dashboard` onto shadcn-vue (Reka UI primitives, copied into `src/components/ui/`) and rebuild the
admin views as a working operations panel: overview with today's agenda, filterable bookings with a detail sheet,
staff, offerings, attendance exceptions and weekly settlements.

## Design plan
- **Subject / audience / job.** A cleaning-services operator in Mexico City. The admin opens the panel to see who
  is cleaning where today, clear what blocks payouts (attendance without GPS, unapproved weeks), and adjust prices.
- **Color.** No new hex values. shadcn variables are aliases of the brand tokens (`background`, `surface`,
  `surface-raised`, `text`, `text-muted`, `primary`, `success`, `warning`, `danger`, `focus`); soft tints are
  `color-mix()` of a token with transparent. Light/dark follow `prefers-color-scheme` like the tokens.
- **Type.** The brand family is `System` → system UI stack (SF Pro on Apple). Large titles 28/34 with negative
  tracking, body 15/20, tabular figures for every amount and time.
- **Layout.** Fixed sidebar on `surface` (heavier material), content on `background`, translucent sticky header
  with blur that falls back to solid under `prefers-reduced-transparency`. Left-aligned content column.
  Mobile: sidebar becomes a left sheet that also exits to the left.
- **The one memorable element.** "Agenda del día": one lane per cleaner, bookings drawn to scale on an hour
  rail, tentative (`held`) bookings hatched, a live "now" line. Everything else stays quiet: grouped lists with
  hairline separators, no KPI tiles, no gradients, no uppercase eyebrows, no mono labels.
- **Motion.** Press feedback on buttons (scale 0.97 on `:active`), sheets/dialogs enter and exit on the same
  path with the iOS sheet curve. Reduced motion → fades only.

## Acceptance
1. `pnpm --filter @repo/web-dashboard typecheck`, `build` and `test` pass.
2. Every data view keeps loading / empty / error-with-retry states (`docs/DESIGN.md`).
3. New dependencies pinned exactly and recorded in `docs/VERSIONS.md`.
4. No business rules invented: hour window of the agenda is presentation only; prices stay admin-entered.
