#!/bin/sh
# Force one release without deleting scheduler, webmention or comment state.
# Stop the normal writer first; restart it even if the one-shot build fails.
set -eu
cd "$(dirname "$0")/.."
restart_builder() {
  rebuild_status=$?
  trap - EXIT
  docker compose up -d builder || {
    if [ "$rebuild_status" -eq 0 ]; then rebuild_status=1; fi
  }
  exit "$rebuild_status"
}
docker compose stop builder
trap restart_builder EXIT
docker compose run --rm --no-deps builder \
  node /repo/apps/builder/src/cli.ts --once --force
