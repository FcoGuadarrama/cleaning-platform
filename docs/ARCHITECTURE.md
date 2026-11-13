# Architecture

```
apps/api            FastAPI modular monolith (Python 3.15, uv-locked) → MySQL 9.7 LTS
apps/web-dashboard  Vue 3 + Vite + Pinia + Tailwind 4 (admin)
apps/mobile-client  Expo SDK 58 + Expo Router + NativeWind 4 (customer + staff roles)
packages/api-client generated from docs/contracts/openapi.json (openapi-typescript + openapi-fetch)
packages/design-tokens  src/brand.json → dist/{tokens.css, tailwind-theme.css, nativewind-preset.cjs, native.js, native.d.ts}
tools/agent-supervisor  deterministic handover/lock/state tooling (outside the LLM)
infra/              nginx + mysql config; docker-compose.yml (worktree) + docker-compose.prod.yml
```

## API modules (`apps/api/app/`)
`core/` (settings, db, security, time, errors) · `models/` (ORM) · `schemas/` (Pydantic transport) ·
`services/` (business logic, transactions) · `routers/` (HTTP) · `payments/` (provider adapters; `sandbox` only).
Routers never touch ORM internals beyond calling services; services own transaction boundaries.

## Key decisions (ADRs in `docs/adr/`)
- 0001 Modular monolith + MySQL-only parity.
- 0002 Concurrency: booking writes lock the staff row (`FOR UPDATE`) then check overlaps → serialised per cleaner.
- 0003 Contract-first client generation + CI drift check.
- 0004 Per-worktree Docker Compose isolation.
- 0005 Auth: opaque random bearer tokens, SHA-256 hashed at rest, expiring; mobile stores in SecureStore.
- 0007 `Idempotency-Key` on hold creation; write services retry InnoDB deadlocks/lock timeouts (then 503).
- 0008 Check-in/out retries return the stored record; lapsed holds are swept with `SKIP LOCKED` (job + reads).
- 0009 Transactional outbox (delivered by ADR 0011's notifications) and housekeeping of keys and sent messages.
- 0010 Renewal job, cancellation, card + SPEI (agent-confirmed) payments; subscriptions block their cleaner ahead.
- 0011 In-app notifications fanned out from the outbox, Expo push per device, push preferences, visit reminders.

## Time and money
UTC `DATETIME(6)` in DB; API emits RFC 3339 with `Z`. Weekday/week rules evaluated in `America/Mexico_City`.
Money = `amount_minor` (BIGINT) + `currency` (CHAR 3).

## Local full stack (`docker-compose.yml`, profile `app`)
`scripts/dev-stack.sh` (or `pnpm stack`) builds and starts `mysql`, `api` (runs `alembic upgrade head`, then uvicorn
`--reload`), the one-shot `admin` bootstrap (`admin@admin.com`, idempotent, password in `.env.worktree`), `web`
(Vite dev server proxying `/api` to `api:8000`) and `mobile` (Expo web; calls the API on the host port, allowed via
`CORS_ORIGINS`). The default `up` attaches with `docker compose watch`: edits under `apps/` and `packages/` sync into the
containers; changing `pnpm-lock.yaml` or `uv.lock` rebuilds the image. `up -d` runs detached without sync. JS deps are
installed inside the Linux image (`infra/dev/node.Dockerfile`), never bind-mounted from the host. Ports come from
`.env.worktree`, so several worktrees can run their stacks at once. Native Expo Go is not containerised; run
`pnpm --filter @repo/mobile-client start` on the host for devices.
Step-by-step guide for the owner (Spanish): `docs/RUNNING.md`.

## Edge / deploy
Cloudflare (Full-strict TLS with origin certificate) → Nginx (TLS, `set_real_ip_from` Cloudflare ranges) → api / dashboard static.
MySQL is only on the internal compose network. Production promotion requires owner approval.
Backups: `scripts/db-backup.sh` (mysqldump `--single-transaction`, gzip, mode 600) and `scripts/db-restore-check.sh`
(restores into scratch schema `restore_check`, compares row counts, drops only the scratch schema). Drill passed 2026-11-03
on the worktree DB. Off-host encrypted copies + schedule: Sprint 4. Deploy/rollback: `scripts/deploy.sh` (immutable SHA tags,
backup before rollout, health check, re-up previous tag on failure; migrations must be expand/contract).

### Production topology (`docker-compose.prod.yml`, `infra/nginx/`)
`nginx` (built by `infra/nginx/Dockerfile`: stage 1 builds `apps/web-dashboard` with pnpm; stage 2 is
`nginx:1.30.6-alpine` serving the static build and reverse-proxying) is the only service with published
host ports (`443`, `80`; `80` returns `444` — HTTP is not served, only used so Cloudflare's health probes
don't hang). `api` and `mysql` publish no host ports. Two Docker networks: `edge` (nginx + api) and
`backend` (`internal: true`; mysql + api + the one-shot `migrate` service) — mysql is unreachable from
outside the compose network under any circumstance.

TLS and trusted-proxy specifics (`infra/nginx/default.conf`):
- Origin certificate: Cloudflare Full (strict) — `ssl_certificate`/`ssl_certificate_key` read from
  `/etc/nginx/tls/origin.pem` / `origin.key`, bind-mounted read-only from `${SECRETS_DIR}/tls/` (outside
  Git; see `.env.prod.example`).
- Authenticated Origin Pulls (mTLS): `ssl_client_certificate /etc/nginx/tls/cloudflare-origin-pull-ca.pem`
  with `ssl_verify_client on` — the origin only accepts TLS connections presenting Cloudflare's client
  certificate, so the box can't be reached by TLS clients that bypass Cloudflare even if its address leaks.
- Trusted proxy / real IP: `infra/nginx/snippets/cloudflare-realip.conf` lists every published Cloudflare
  IPv4 + IPv6 range as `set_real_ip_from`, plus `real_ip_header CF-Connecting-IP;`, so `$remote_addr` (and
  the `X-Forwarded-For` nginx forwards to `api`) reflects the real client IP only when the connection
  actually came from Cloudflare. Regenerate with `scripts/cloudflare-realip.sh` (pulls
  https://www.cloudflare.com/ips/) and review the diff — ranges change rarely but are not pinned forever.
- `/api/` proxies to the `api` upstream (`api:8000`) stripping the `/api` prefix (matches
  `docs/contracts/openapi.json`, which has no `/api` prefix on its own paths); `/healthz` proxies straight
  through for infra health checks; everything else serves the dashboard static build with SPA fallback
  (`try_files $uri /index.html`).
