#!/bin/sh
# Moderation of the comments from the command line, no login in the browser needed.
#   docker/moderate.sh list [n]                  latest comments with id, author id and page
#   docker/moderate.sh delete <id> <page-url>    delete a comment
#   docker/moderate.sh block <user-id> [7d]      block a user (optionally for a time)
#   docker/moderate.sh unblock <user-id>
# Uses the administrator login (REMARK_ADMIN_PASSWD from .env) inside the builder
# container, so the password never travels over the network. For other Compose
# files set COMPOSE_FILE, for example COMPOSE_FILE=compose.yaml:compose.production.yaml
set -eu
cd "$(dirname "$0")/.."
PASSWORD="$(sed -n 's/^REMARK_ADMIN_PASSWD=//p' .env)"
[ -n "$PASSWORD" ] || { echo "REMARK_ADMIN_PASSWD is not set in .env" >&2; exit 1; }
exec docker compose exec -T -e REMARK_ADMIN_PASSWD="$PASSWORD" builder node src/remark-admin-cli.ts "$@"
