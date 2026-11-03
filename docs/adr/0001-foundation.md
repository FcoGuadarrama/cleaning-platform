# ADR 0001–0005 — Foundation decisions (2026-11-03, accepted)

**0001 Modular monolith, MySQL-only.** One FastAPI service with internal modules; the business is small
(~2 services/day) and the owner maintains it alone. MySQL 9.7 LTS everywhere, including tests, so locking
and SQL-mode behaviour is identical across environments.

**0002 Reservation concurrency.** Booking creation runs in one transaction: `SELECT … FROM staff_profiles
WHERE id = :id FOR UPDATE`, then overlap query (with travel buffer and unexpired holds), then insert. All
writers for a cleaner serialise on that row lock. Client-side availability is advisory only. Tested with
concurrent sessions against MySQL.

**0003 Contract-first client.** `app.export_openapi` writes `docs/contracts/openapi.json` deterministically
(sorted keys). `openapi-typescript` generates `packages/api-client/src/schema.d.ts`. CI regenerates both
and fails on `git diff`. Operation IDs are explicit route names (`<tag>_<action>`).

**0004 Worktree isolation.** `scripts/wt-env.sh` derives a stable slug from the worktree path and writes
`.env.worktree` (compose project, MySQL port, db name, password). Each worktree has its own container
and named volume; a successor agent reuses it.

**0005 Auth tokens.** Opaque 32-byte tokens, stored hashed (SHA-256), with expiry. Simple to revoke and
audit; no JWT key management. Passwords hashed with `hashlib.scrypt` (stdlib).
