#!/usr/bin/env bash
# Host-side deploy by immutable tag with backup, health check and rollback to the previous tag.
# Usage: scripts/deploy.sh <staging|production> <git-sha>
# Migrations must be backward compatible (expand → migrate → contract) so rollback never needs a downgrade.
set -euo pipefail
env="$1"; tag="$2"
export DEPLOY_ENV="$env" REGISTRY="${REGISTRY:-ghcr.io/${GITHUB_REPOSITORY:?set REGISTRY or GITHUB_REPOSITORY}}"
state="/var/lib/cleaning-platform/$env.tag"
prev="$(cat "$state" 2>/dev/null || true)"
compose() { IMAGE_TAG="$1" docker compose -f docker-compose.prod.yml "${@:2}"; }
[[ -n "$prev" ]] && scripts/db-backup.sh -f docker-compose.prod.yml
compose "$tag" pull
compose "$tag" up -d --wait
if compose "$tag" exec -T api python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8000/healthz')"; then
  mkdir -p "$(dirname "$state")" && echo "$tag" > "$state.tmp" && mv "$state.tmp" "$state"
  echo "deployed $env @ $tag"
else
  echo "health check failed; rolling back to ${prev:-<none>}" >&2
  [[ -n "$prev" ]] && compose "$prev" up -d --wait
  exit 1
fi
