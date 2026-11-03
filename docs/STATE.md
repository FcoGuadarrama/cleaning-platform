# Project state — 2026-11-03

**Branch:** `feat/retomar-trabajo-pendiente` (continued from `feat/monorepo-platform-foundation`) (not pushed, no PR yet — needs owner approval to push).

## Done
- Shared docs (AGENTS + symlinks, PRODUCT, DOMAIN, ARCHITECTURE, ADRs, VERSIONS, DESIGN, SPRINTS, AGENT_OPS, contracts).
- Sprint 1 slice: FastAPI + MySQL 9.7.4 API, generated client, tokens, Vue dashboard, Expo SDK 58 app, smoke script.
- Supervisor for failover (simulated-failure tests), CI + deploy workflows, prod compose, Nginx origin, backup/restore drill.

## Foundation verification reported by the previous agent (2026-11-03)
pytest 19 passed (MySQL) · alembic up/down/up + `alembic check` clean · ruff/mypy clean · supervisor 16 tests ·
`pnpm check:drift` clean · `pnpm -r typecheck` · tokens 5 tests · dashboard vitest 3 · dashboard build ·
`expo install --check` · docker builds (api, origin) · `nginx -t` · api image /healthz · backup+restore drill ·
`scripts/smoke-e2e.sh` · Codex reads AGENTS.md.

## Not run / pending
GitHub Actions (no push) · mobile app on simulator/device · Codex task through Shep (docs/AGENT_OPS.md) ·
staging host (not chosen) · Gemini/Cursor (not installed).

## Recent decisions
TypeScript 6.0.3 (TS 7 breaks openapi-typescript/vue-tsc) · Node 26 has no corepack → `npm i -g pnpm@12.16.1` ·
sandbox is the only payment provider · automatic handover disabled until Shep retries can be excluded.

## Continuation
Codex recovered the pending documentation in the continuation worktree. Current verification and
remaining steps are recorded in `WORKTREE_STATE.md`; the original worktree is preserved.

## Continuation verification (Codex, 2026-11-03)
21 API tests on separate MySQL cp_233f1407; 16 supervisor, 5 token and 3 dashboard tests pass.
Ruff, mypy, workspace typechecks/builds, drift checks and API/origin image builds pass.
Aislop: 100/100, no findings. Handoff: `docs/tasks/002-shep-codex-probe/handoff.md`.
Shep registration/global routing was not independently verified; device QA and staging remain pending.
