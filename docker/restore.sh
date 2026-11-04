#!/bin/sh
# Puts the comments of a backup (docker/backup.sh) back into Remark42.
#   docker/restore.sh <backup.tar.gz>
# Remark42 replaces the comments of the site with those of the backup. The secrets
# are NOT restored automatically: the file `env` in the backup is your old .env,
# copy it by hand if you need it.
set -eu
cd "$(dirname "$0")/.."
[ $# -eq 1 ] && [ -f "$1" ] || { echo "usage: docker/restore.sh <backup.tar.gz>" >&2; exit 1; }
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
tar -xzf "$1" -C "$work" comments.json.gz
gzip -t "$work/comments.json.gz" || { echo "The backup does not contain a valid comments file" >&2; exit 1; }
docker/moderate.sh import < "$work/comments.json.gz"
echo "Comments restored. The pages are rebuilt at the next check."
