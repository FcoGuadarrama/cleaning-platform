#!/usr/bin/env bash
# Restore drill: loads a backup into a scratch schema `restore_check`, compares per-table row counts with the
# live schema and drops only that scratch schema. Never touches the live schema.
# Usage: scripts/db-restore-check.sh <backup.sql.gz> [compose args...]
set -euo pipefail
backup="$1"; shift
root="$(git rev-parse --show-toplevel)"; cd "$root"
sql() { docker compose "$@" exec -T mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -B 2>/dev/null'; }
counts() {
  echo "SELECT table_name FROM information_schema.tables WHERE table_schema='$1' AND table_type='BASE TABLE' ORDER BY 1;" \
    | sql "${@:2}" | while read -r t; do echo "$t $(echo "SELECT COUNT(*) FROM \`$1\`.\`$t\`;" | sql "${@:2}")"; done
}
live="$(docker compose "$@" exec -T mysql sh -c 'echo $MYSQL_DATABASE' | tr -d '\r')"
echo "DROP DATABASE IF EXISTS restore_check; CREATE DATABASE restore_check CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;" | sql "$@"
{ echo "USE restore_check;"; gunzip -c "$backup"; } | sql "$@"
if diff <(counts "$live" "$@") <(counts restore_check "$@"); then status=0; echo "restore OK: row counts match ($live)"; else status=1; echo "restore MISMATCH"; fi
echo "DROP DATABASE restore_check;" | sql "$@"
exit "$status"
