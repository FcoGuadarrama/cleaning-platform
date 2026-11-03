# Task 001 — Monorepo platform foundation + Sprint 1 slice

- **Owner:** claude-code (coordinator acting as implementer) · **Base SHA:** 6077b0aded3a45da8107768fd4e7c63d34963113
- **Contracts:** docs/contracts/openapi.json sha256 99336ffb99c2101aa635337ef156a9720934d642afa0e939a2f62b7bf74d4b20

## Objective
Bootstrap the monorepo on the verified version matrix and deliver the Sprint 1 local-demo slice
(`docs/SPRINTS.md`) plus the agent failover tooling.

## Scope / allowed files
`apps/*`, `packages/*`, `docs/**`, `infra/**`, `scripts/*`, `tools/agent-supervisor/*`, `.github/workflows/*`,
compose files, root workspace config, `AGENTS.md` (+ `CLAUDE.md`/`GEMINI.md` symlinks, `.cursor/rules/`).

## Acceptance
1. `docs/VERSIONS.md` records every selected version with LTS/stable-only status and evidence.
2. Sprint 1 items 1–7 in `docs/SPRINTS.md` pass against the worktree MySQL (`uv run pytest`, `scripts/smoke-e2e.sh`).
3. `pnpm check:drift` clean; `pnpm -r typecheck` and builds pass.
4. Supervisor unit tests cover simulated quota exhaustion, mid-edit termination, stale checkpoint, ordinary
   failure, contract mismatch and concurrent takeover.
5. Not in scope: push/PR (owner approval), staging deploy, Shep-registered Codex run (task 002).
