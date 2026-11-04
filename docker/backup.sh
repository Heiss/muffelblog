#!/bin/sh
# Backup of what cannot be rebuilt: the comments (Remark42 export) and the secrets (.env).
#   docker/backup.sh [folder]        default folder: ./backups
# The file contains your secrets: keep it private (it is created readable by you only)
# and copy it somewhere else; a backup on the same disk is not a backup.
# Posts live in Nextcloud and memos in Memos, back those up there.
set -eu
cd "$(dirname "$0")/.."
folder="${1:-backups}"
umask 077
mkdir -p "$folder"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

docker/moderate.sh export > "$work/comments.json.gz"
gzip -t "$work/comments.json.gz" || { echo "The export is not a valid gzip file, nothing was saved" >&2; exit 1; }
cp .env "$work/env"

file="$folder/muffelblog-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
tar -czf "$file" -C "$work" comments.json.gz env
echo "$file"
