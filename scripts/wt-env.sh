#!/usr/bin/env bash
# Writes .env.worktree with a stable, per-worktree Compose project, ports, database and credentials.
# Idempotent: existing values are kept so a successor agent reuses the same database volume;
# keys added to this script after the file was first written are appended.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
out="$root/.env.worktree"
tmp="$out.tmp"
umask 077
if [[ -f "$out" ]]; then cp "$out" "$tmp"; else : > "$tmp"; fi

value() { sed -n "s/^$1=//p" "$tmp"; }
added=()
add() {
  if ! grep -q "^$1=" "$tmp"; then
    printf '%s=%s\n' "$1" "$2" >> "$tmp"
    added+=("$1")
  fi
}

hash="$(printf '%s' "$root" | shasum -a 256 | cut -c1-8)"
add COMPOSE_PROJECT_NAME "cp_${hash}"
add MYSQL_PORT "$(( 33060 + (16#${hash:0:4} % 2000) ))"
port="$(value MYSQL_PORT)"
add API_PORT "$(( port + 2000 ))"
add WEB_PORT "$(( port + 4000 ))"
add MOBILE_PORT "$(( port + 6000 ))"
add MYSQL_DATABASE app
add MYSQL_USER app
add MYSQL_PASSWORD "$(openssl rand -hex 16)"
add MYSQL_ROOT_PASSWORD "$(openssl rand -hex 16)"
pw="$(value MYSQL_PASSWORD)"
add DATABASE_URL "mysql+asyncmy://app:${pw}@127.0.0.1:${port}/app?charset=utf8mb4"
add TEST_DATABASE_URL "mysql+asyncmy://app:${pw}@127.0.0.1:${port}/app_test?charset=utf8mb4"
add SANDBOX_WEBHOOK_SECRET "$(openssl rand -hex 16)"
add ADMIN_PASSWORD "$(openssl rand -hex 8)"

project="$(value COMPOSE_PROJECT_NAME)"
mv "$tmp" "$out"
if (( ${#added[@]} == 0 )); then
  echo "kept $out"
else
  echo "wrote $out (project ${project}, added: ${added[*]})"
fi
