# WORKTREE STATE & HANDOFF LOG
- **Feature:** staff app review — Servicios agenda; late earnings in an already-settled week could not be approved
- **Current Agent:** claude-code
- **Last Updated:** 2026-11-11T00:24:27Z
- **Branch / Worktree:** fix/panel-personal-agenda (main worktree), from feature/contratar-suscripcion 3f1252d (= content merged as PR #10)
- **Base SHA:** 3f1252d
- **Contract Version:** docs/contracts/openapi.json — EarningsSummaryOut gains `settlements: SettlementOut[]`
- **Database:** compose project cp_f4bbf0f0 (app + app_test at alembic 0005: settlements (staff_id, week_start) no longer unique)

## Microtask checklist
- [x] 1. Review staff panel: API (/auth/me, /bookings, /me/earnings, /offerings) works for test+ana@test.com.
- [x] 2. Servicios: Próximos / Historial tabs. Próximos = confirmed + in progress (next service card + agenda);
      Historial = everything else, newest first. Before: one list of 62 rows, oldest (Sept) first, cancelled/expired mixed in.
- [x] 3. Settlements: several per staff-week (migration 0005), summary lists them, dashboard pays the unpaid one from
      server data (not session memory), approve enabled whenever earned_minor > 0; app Ganancias shows the week total.
- [ ] 4. Visual check in the browser as a staff user (needs an owner login: auto mode blocks reading the demo password).

## Immediate context / Handoff notes
Staff screens: app/(staff)/(tabs)/{index,earnings,account}.tsx, app/(staff)/job/[id].tsx. Not implemented yet (by design,
"Próximamente"): Soporte e incidencias, Notificaciones; earnings only current week; earnings rows read "Servicio #id".
The mobile container has no bind mount and compose watch had stopped; the edited file was copied in with docker cp.

## Verification
- 2026-11-11T00:17:59Z: mobile tsc --noEmit clean; Expo web bundle rebuilt and contains the new tabs. Browser not exercised (no login).

- 2026-11-11T00:24:27Z: pytest 51 passed (new: late booking in a settled week gets its own settlement); ruff/format/mypy clean;
  alembic downgrade/upgrade + check clean on app_test; dashboard vue-tsc + vitest 30 passed; mobile tsc clean;
  stack rebuilt (`docker compose ... up --build --detach --wait api web mobile`, volumes kept), app DB at 0005.

## Partial work
- None.

## Exact next action
- Owner logs in as a staff demo user to check Servicios visually; then PR (push/merge need owner approval).
