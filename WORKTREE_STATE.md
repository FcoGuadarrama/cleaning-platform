# WORKTREE STATE & HANDOFF LOG
- **Feature:** 004-mis-domicilios (saved customer addresses, docs/tasks/004-mis-domicilios.md)
- **Current Agent:** claude-code
- **Last Updated:** 2026-11-09T19:22:40Z
- **Branch / Worktree:** feature/mis-domicilios (current worktree)
- **Base SHA:** 94236a9
- **Contract Version:** docs/contracts/openapi.json sha256 2e0d4386b3901ee6d446e24f5f89545032ffdccf6d4e0077d4529ac730e6d7c6 (changed: /addresses, booking address_id)
- **Database:** compose project cp_39ed4883 (app + app_test at alembic 0002)

## Microtask checklist
- [x] 1. API: CustomerAddress model, migration 0002, /addresses CRUD (customer only), booking takes address_id and
      stores a text snapshot, MAX_ADDRESSES_PER_CUSTOMER config, seed_demo saves 2 addresses for test@test.com.
- [x] 2. Tests: tests/test_addresses.py (default rules, concurrency, ownership, validation, cap, snapshot).
- [x] 3. Contract exported, api-client regenerated.
- [ ] 4. Mobile: Mis domicilios list + form, booking address picker, Inicio default address.
- [ ] 5. Browser walkthrough, docs (DESIGN.md, brisa-feature-gaps.md gap 7, DOMAIN.md glossary).

## Immediate context / Handoff notes
Previous handoff (app-design) is in git history (94236a9). Service-area check and geocoding stay out (decisions
7 and 5 open). Address writes lock the user row and update default flags by primary key only: a ranged UPDATE on
customer_id deadlocked with other customers' inserts (gap locks). Migration downgrade drops the table without
dropping its FK index first (MySQL 1553).

## Verification
- Last command executed: uv run pytest (3 consecutive runs), ruff check, mypy app, alembic check.
- Result and timestamp: 29 passed ×3; ruff/mypy clean; no drift (2026-11-09T19:22:40Z).
- Pending tests: pnpm -r typecheck, check:drift, browser walkthrough.

## Partial work
- Modified or new files: see git status.
- Operations in progress: none.
- Blockers: none.

## Exact next action
- Build apps/mobile-client/app/(customer)/addresses screens and replace the free-text address in book.tsx.
