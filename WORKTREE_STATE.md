# WORKTREE STATE & HANDOFF LOG
- **Feature:** bookings table sort + filters (admin dashboard, follow-up to docs/tasks/005-admin-bookings.md)
- **Current Agent:** claude-code
- **Last Updated:** 2026-11-10T15:47:06Z
- **Branch / Worktree:** feature/reservas-orden-filtros (current worktree), from origin/main a884bed
- **Base SHA:** a884bed
- **Contract Version:** unchanged (no API changes)
- **Database:** compose project cp_5f97f191 (app + app_test at alembic 0002; app seeded with app.seed_demo)

## Microtask checklist
- [x] 1. View model: viewmodels/bookingTable.ts (sort by column, default newest first; filters by person,
      service name, business-day range and search; "#N" searches one booking exactly); unit tests.
- [x] 2. Components: SortableHead (arrows + aria-sort), FilterSelect (native select).
- [x] 3. BookingsView: every column sortable, filter toolbar, sort/filters kept in the URL query
      (orden, dir, persona, servicio, desde, hasta); status-tab counts follow the toolbar filters.

## Immediate context / Handoff notes
"Próximas" no longer lists soonest first: the owner asked for newest first everywhere in the bookings table;
clicking Fecha flips it. The service filter groups offering versions by name (price changes create versions).

## Verification
- 2026-11-10T15:47:06Z: dashboard typecheck clean; vitest 20 passed; build OK. Browser (cp_5f97f191 web): default newest
  first, sort by Importe, person + date filters with updated tab counts, Quitar filtros; no console errors.

## Partial work
- None.
