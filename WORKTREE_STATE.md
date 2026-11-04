# WORKTREE STATE & HANDOFF LOG
- **Feature:** docker-full-stack (one command to run the whole app in Docker)
- **Current Agent:** claude-code
- **Last Updated:** 2026-11-04T16:38:52Z
- **Branch / Worktree:** feature/docker (current worktree)
- **Base SHA:** 6c57d57024beedb2fe75142e3c6ff949e2fdca4d
- **Contract Version:** docs/contracts/openapi.json sha256 99336ffb99c2101aa635337ef156a9720934d642afa0e939a2f62b7bf74d4b20 (unchanged)
- **Database:** compose project cp_29c0b027, volume cp_29c0b027_mysql-data (migrated to head; admin@admin.com id=1)

## Microtask checklist
- [x] 1. scripts/wt-env.sh appends missing keys to an existing .env.worktree (WEB_PORT, MOBILE_PORT, SANDBOX_WEBHOOK_SECRET, ADMIN_PASSWORD) and keeps existing values.
- [x] 2. app.create_admin is idempotent (skips an existing admin, exits non-zero if the email belongs to another role).
- [x] 3. docker-compose.yml profile `app`: api (migrate + uvicorn --reload), admin one-shot, web (Vite), mobile (Expo web); infra/dev/node.Dockerfile.
- [x] 4. scripts/dev-stack.sh [up [-d] | down | logs | ps] + `pnpm stack` alias.
- [x] 5. Docs: AGENTS.md commands, docs/ARCHITECTURE.md "Local full stack".
- [x] 6. docs/RUNNING.md: owner run guide in Spanish (owner-facing, per AGENTS.md language rule), linked from AGENTS.md and ARCHITECTURE.md.

## Immediate context / Handoff notes
`docker compose up -d mysql` without a profile still starts only MySQL, so the test workflow is unchanged.
Native Expo Go (devices) is not containerised; only Expo web runs in Docker.

## Verification
- `./scripts/dev-stack.sh up -d`: all services healthy; admin created. API /healthz ok; login via Vite proxy /api returns a token;
  CORS preflight from the Expo origin allowed; Expo web index + bundle 200 and bundle embeds the host API URL.
- `./scripts/dev-stack.sh` (watch): edits to apps/api/app/main.py and apps/web-dashboard/src/App.vue synced; uvicorn reloaded; admin rerun printed "already exists".
- `./scripts/dev-stack.sh down`: containers and network removed, MySQL volume kept.
- apps/api: ruff check/format and mypy on create_admin.py clean; `uv run pytest` 21 passed (2026-11-03T19:59:54Z).
- shellcheck and aislop are not installed on this machine; not run.

## Partial work
- Modified or new files: AGENTS.md, docker-compose.yml, docs/ARCHITECTURE.md, package.json, scripts/wt-env.sh, scripts/dev-stack.sh,
  apps/api/app/create_admin.py, docs/RUNNING.md, infra/dev/node.Dockerfile, infra/dev/node.Dockerfile.dockerignore, WORKTREE_STATE.md.
- Operations in progress: none (worktree MySQL container left running for tests).
- Blockers: none.

## Exact next action
- Owner review; merge/push only with explicit approval.
