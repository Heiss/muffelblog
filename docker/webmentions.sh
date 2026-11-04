#!/bin/sh
# Outgoing webmentions from the command line, inside the builder container.
#   docker/webmentions.sh list             what was sent, what failed, what was given up
#   docker/webmentions.sh send-existing    send the existing entries on purpose
# Sending is off by default (MUFFEL_WEBMENTIONS_SEND=1 in .env). For other Compose
# files set COMPOSE_FILE, for example COMPOSE_FILE=compose.yaml:compose.production.yaml
set -eu
cd "$(dirname "$0")/.."
exec docker compose exec -T builder node src/webmentions-cli.ts "$@"
