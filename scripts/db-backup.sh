#!/usr/bin/env bash
# Consistent logical backup of the app schema from a Compose MySQL service.
# Usage: scripts/db-backup.sh [compose args...]   e.g. --env-file .env.worktree   |   -f docker-compose.prod.yml
# Output: backups/<project>-<UTC>.sql.gz (mode 600, gitignored). Copy off-host and encrypt before retention.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"; cd "$root"
mkdir -p backups && chmod 700 backups
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="backups/$(docker compose "$@" config --format json | python3 -c 'import json,sys;print(json.load(sys.stdin)["name"])')-${stamp}.sql.gz"
umask 077
docker compose "$@" exec -T mysql sh -c \
  'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers --set-gtid-purged=OFF "$MYSQL_DATABASE"' \
  | gzip -9 > "$out.tmp"
mv "$out.tmp" "$out"
echo "$out"
