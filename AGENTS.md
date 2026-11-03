# AGENTS.md — shared rules for every agent (Claude Code, Codex, Gemini, Cursor)

`CLAUDE.md` and `GEMINI.md` are relative symlinks to this file. Cursor reads `.cursor/rules/agents.mdc`.

## Language
Technical docs, code and this file: English. Owner communication and customer-facing copy: Spanish (es-MX).

## Read order (do not load everything)
1. This file → 2. `WORKTREE_STATE.md` (if present) → 3. `docs/tasks/<id>.md` (your task)
4. `docs/DOMAIN.md` (invariants) → 5. only the contracts your task touches in `docs/contracts/`.
Index: `docs/PRODUCT.md` scope · `docs/ARCHITECTURE.md` + `docs/adr/` · `docs/VERSIONS.md` ·
`docs/DESIGN.md` · `docs/SPRINTS.md` · `docs/STATE.md` · `docs/AGENT_OPS.md` (Shep, failover, handover).

## Hard rules
- Stack is fixed (FastAPI/SQLAlchemy async/Alembic · Vue+Vite+Pinia+Tailwind · Expo+Router+NativeWind · MySQL). No substitutions.
- **MySQL only** for every app DB and persistence test. Never SQLite/PostgreSQL. Never point at production or a shared schema.
- Versions come from `docs/VERSIONS.md`; never float `latest`. Changing one = reviewed PR.
- Do not invent business rules. Prices, durations, billing cycle, cleaner compensation for late cancellations,
  geofence radius etc. are **open** (see `docs/PRODUCT.md`). Use config/placeholders, never hardcoded "decisions".
- Server enforces roles and resource ownership. Public signup only creates `customer`.
- Money: integer minor units (centavos) + ISO currency. Time: store UTC `DATETIME(6)`, business tz `America/Mexico_City`.
- Transport DTOs (Pydantic schemas / generated TS) ≠ ORM models ≠ frontend view models.
- Never hand-edit `packages/api-client/src/schema.d.ts` or `packages/design-tokens/dist/*`; regenerate.
- No secrets, real customer data or full histories in Git, logs or prompts. Test users: `admin@admin.com`, `test@test.com`.
- Merge, push to shared remotes, deploy, spend or live payments require explicit owner approval.

## Commands
```sh
npm i -g pnpm@12.16.1 && pnpm install          # JS workspace (Node 26 has no corepack)
./scripts/wt-env.sh                             # writes .env.worktree (unique compose project/ports/db)
docker compose --env-file .env.worktree up -d mysql
set -a && . ./.env.worktree && set +a          # export DATABASE_URL / TEST_DATABASE_URL
cd apps/api && uv sync && uv run alembic upgrade head
uv run pytest                                   # needs worktree MySQL up + exported env
uv run --no-project --python 3.15 python -m unittest ../../tools/agent-supervisor/test_supervisor.py
uv run python -m app.export_openapi             # → docs/contracts/openapi.json
pnpm --filter @repo/api-client generate         # → schema.d.ts
pnpm --filter @repo/design-tokens build         # → dist/
pnpm -r typecheck && pnpm -r build
pnpm check:drift                                # contract + tokens must be clean in git
```

## WORKTREE_STATE.md checkpoints (mandatory for every worker)
- Keep `WORKTREE_STATE.md` at the worktree root using `docs/templates/WORKTREE_STATE.md`.
- End of each microtask: **update state first** (atomic write: `tools/agent-supervisor/statefile.py` or
  write temp file + `mv`), then a WIP commit with the state + relevant files (`git add <paths>`, never `-A`).
- Target a checkpoint every 3–5 min of real progress. No empty commits, no secrets.
- If the commit fails, record the failure in the state file and keep the files.
- The state file never contains its own commit SHA; the supervisor records checkpoint SHAs in `.agent-supervisor/`.
- When integrating several features, archive handoffs to `docs/tasks/<id>/handoff.md`.

## Handover prompt (successor agents)
Work in the specified worktree. Read AGENTS.md, WORKTREE_STATE.md, the assigned task, domain summary and relevant
contracts. Inspect git status, staged/unstaged diffs and new files. Check the base SHA, contract hashes and worktree
database/migration state. Preserve completed work: briefly verify that it exists and meets acceptance, changing it only
if evidence shows a problem. Resume the pending microtask while accounting for changes newer than the checkpoint. Do not
discard modifications, reset the database or repeat external operations. Update WORKTREE_STATE.md before the next WIP
commit and record actual verification results.

## Never
`git reset --hard`, `git clean`, `git checkout -- .`, worktree/volume deletion, `docker compose down -v`,
editing Shep's internal database, switching to paid API billing, or reporting tests that did not run.
