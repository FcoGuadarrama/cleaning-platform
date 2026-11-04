#!/usr/bin/env bash
# Full local stack in Docker: MySQL, API (migrations + reload), admin bootstrap, web dashboard, Expo web.
#   scripts/dev-stack.sh          build, start and follow logs; source edits sync into the containers
#   scripts/dev-stack.sh up -d    same, in the background (no file sync)
#   scripts/dev-stack.sh down     stop and remove containers; the MySQL volume is kept
#   scripts/dev-stack.sh logs [service] | ps
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
cd "$root"
./scripts/wt-env.sh >/dev/null
set -a && . ./.env.worktree && set +a

compose() { docker compose --env-file .env.worktree --profile app "$@"; }

urls() {
  cat <<EOF

  Web dashboard  http://localhost:${WEB_PORT}
  Expo web       http://localhost:${MOBILE_PORT}
  API docs       http://localhost:${API_PORT}/docs
  MySQL          127.0.0.1:${MYSQL_PORT} (db ${MYSQL_DATABASE}, user ${MYSQL_USER})
  Admin login    admin@admin.com / ${ADMIN_PASSWORD}

EOF
}

cmd="${1:-up}"
[[ $# -gt 0 ]] && shift
case "$cmd" in
  up)
    if [[ "${1:-}" == "-d" ]]; then
      compose up --build --detach --wait api web mobile
      compose up --no-deps admin
      urls
    else
      urls
      compose up --build --watch
    fi
    ;;
  down) compose down ;;
  logs) compose logs --follow "$@" ;;
  ps) compose ps ;;
  *) echo "usage: $0 [up [-d] | down | logs [service] | ps]" >&2; exit 2 ;;
esac
