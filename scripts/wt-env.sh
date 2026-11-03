#!/usr/bin/env bash
# Writes .env.worktree with a stable, per-worktree Compose project, port, database and credentials.
# Idempotent: an existing file is kept so a successor agent reuses the same database volume.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
out="$root/.env.worktree"
if [[ -f "$out" ]]; then echo "kept $out"; exit 0; fi
hash="$(printf '%s' "$root" | shasum -a 256 | cut -c1-8)"
slug="cp_${hash}"
port=$(( 33060 + (16#${hash:0:4} % 2000) ))
api_port=$(( port + 2000 ))
pw="$(openssl rand -hex 16)"
umask 077
cat > "$out.tmp" <<ENV
COMPOSE_PROJECT_NAME=${slug}
MYSQL_PORT=${port}
API_PORT=${api_port}
MYSQL_DATABASE=app
MYSQL_USER=app
MYSQL_PASSWORD=${pw}
MYSQL_ROOT_PASSWORD=$(openssl rand -hex 16)
DATABASE_URL=mysql+asyncmy://app:${pw}@127.0.0.1:${port}/app?charset=utf8mb4
TEST_DATABASE_URL=mysql+asyncmy://app:${pw}@127.0.0.1:${port}/app_test?charset=utf8mb4
ENV
mv "$out.tmp" "$out"
echo "wrote $out (project ${slug}, mysql port ${port})"
