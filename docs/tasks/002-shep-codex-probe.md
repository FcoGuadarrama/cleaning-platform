# Task 002 — Shep → Codex orchestration probe

- **Owner:** codex-cli (via Shep) · **Base SHA:** 8b9da052b45ff4810d2a4aff2e194cf21984b1a3 (branch `feat/monorepo-platform-foundation`)
- **Contracts:** docs/contracts/openapi.json sha256 99336ffb99c2101aa635337ef156a9720934d642afa0e939a2f62b7bf74d4b20

## Objective
Prove a Shep-launched Codex worker gets an isolated worktree + MySQL, follows AGENTS.md, reads a contract and
leaves a durable handoff. Tiny, reversible change only.

## Scope / allowed files
- `apps/api/tests/test_contract_probe.py` (new) — assert `operationId` `bookings_create_hold` exists in
  `docs/contracts/openapi.json` and `/healthz` returns 200 against the worktree MySQL test schema.
- `WORKTREE_STATE.md`, `docs/tasks/002-shep-codex-probe/handoff.md`.
No contract, migration or business-rule changes.

## Acceptance
1. `./scripts/wt-env.sh` created a **distinct** `COMPOSE_PROJECT_NAME`/port from other worktrees; MySQL up.
2. `uv run pytest -q` passes (existing 19 + probe) against MySQL.
3. `WORKTREE_STATE.md` follows `docs/templates/WORKTREE_STATE.md`, records the contract SHA-256 above, and
   `supervisor.py verify --no-db` returns `consistent: true` after the final checkpoint.
4. WIP commits staged by path (no `git add -A`), no secrets.
