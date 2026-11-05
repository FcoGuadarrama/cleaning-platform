#!/usr/bin/env bash
# Full local stack in Docker: MySQL, API (migrations + reload), admin bootstrap, web dashboard, Expo web.
#   scripts/dev-stack.sh          build, start and follow logs; source edits sync into the containers
#   scripts/dev-stack.sh up -d    same, in the background (no file sync)
#   scripts/dev-stack.sh up --ios also queues an iOS development build on EAS first (combines with -d)
#   scripts/dev-stack.sh eas <args>  run any EAS CLI command, e.g. `eas login`, `eas device:create`
#   scripts/dev-stack.sh down     stop and remove containers; the MySQL volume is kept
#   scripts/dev-stack.sh logs [service] | ps
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
cd "$root"
./scripts/wt-env.sh >/dev/null
set -a && . ./.env.worktree && set +a

compose() { docker compose --env-file .env.worktree --profile app "$@"; }
eas_cli() { compose run --rm --build eas "$@"; }
usage() { echo "usage: $0 [up [-d] [--ios] | eas <args> | down | logs [service] | ps]" >&2; exit 2; }

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
    detach=false ios=false
    for arg in "$@"; do
      case "$arg" in
        -d) detach=true ;;
        --ios) ios=true ;;
        *) usage ;;
      esac
    done
    # --no-wait returns once the project is uploaded; the build page on expo.dev shows the install QR when done.
    if $ios; then eas_cli build --platform ios --profile development --no-wait; fi
    if $detach; then
      compose up --build --detach --wait api web mobile
      compose up --no-deps admin
      urls
    else
      urls
      compose up --build --watch
    fi
    ;;
  eas) eas_cli "$@" ;;
  down) compose down ;;
  logs) compose logs --follow "$@" ;;
  ps) compose ps ;;
  *) usage ;;
esac
