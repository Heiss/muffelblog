#!/bin/sh
# End to end: new comment mails the administrator, backup, moderation (delete) removes
# the comment from the page, restore brings it back. Needs the running demo stack
# with a short check interval (see comment-flow.sh).
# Usage: docker/moderation-flow.sh [site-url] [mail-url]
set -eu
SITE="${1:-http://localhost:8080}"
MAIL="${2:-http://localhost:8025}"
PAGE="/p/backups-zurueckspielen/"
MARK="Moderation-Test-$(date +%s)"
cd "$(dirname "$0")/.."
backups="$(mktemp -d)"
trap 'rm -rf "$backups"' EXIT

wait_for() { # description, shell test that must succeed
  i=0
  until sh -c "$2"; do
    i=$((i+1))
    if [ $i -ge 60 ]; then
      echo "FAIL  $1"
      echo "--- mails in Mailpit:"; curl -s "$MAIL/api/v1/messages?limit=10" | head -c 1500; echo
      echo "--- builder state:"
      docker compose exec -T builder sh -c 'cat /data/state/scheduler.json /data/state/status.json; ls /data/releases' || true
      echo "--- Remark42 last/1000:"
      docker compose exec -T builder sh -c 'wget -qO- "http://remark42:8080/api/v1/last/1000?site=muffelblog" | head -c 700' || true; echo
      docker compose logs --no-color --tail 15 builder remark42
      exit 1
    fi
    sleep 3
  done
  echo "ok    $1"
}
on_page() { curl -s "$SITE$PAGE" | grep -q "$MARK"; }

# 1. A reader comments: login by email, then comment (as in the browser).
docker compose exec -T builder node /repo/docker/visitor-comment.mjs "$SITE$PAGE" "$MARK"
wait_for "the comment is on the page" "curl -s '$SITE$PAGE' | grep -q '$MARK'"

# 2. The administrator gets a mail about the new comment.
wait_for "the administrator was mailed about the new comment" \
  "curl -s '$MAIL/api/v1/search?query=$MARK' | grep -q '\"messages_count\":[1-9]'"

# 3. Backup.
file="$(docker/backup.sh "$backups")"
[ -s "$file" ] && echo "ok    backup written ($(wc -c < "$file") bytes)"

# 4. Moderation: find the comment and delete it.
line="$(docker/moderate.sh list 50 | grep -B1 "$MARK" | head -1)"
id="$(echo "$line" | awk '{print $1}')"
url="$(echo "$line" | awk '{print $NF}')"
[ -n "$id" ] && [ -n "$url" ] || { echo "FAIL  the comment is not in the list: $line"; exit 1; }
docker/moderate.sh delete "$id" "$url"
wait_for "the deleted comment is gone from the page" "! curl -s '$SITE$PAGE' | grep -q '$MARK'"

# 4b. Moderation: block the reader, they can no longer comment; unblock, they can.
uid="$(echo "$line" | sed 's/.*(\(.*\)).*/\1/' | awk '{print $NF}')"
docker/moderate.sh block "$uid"
if docker compose exec -T builder node /repo/docker/visitor-comment.mjs "$SITE$PAGE" "$MARK-blocked" >/dev/null 2>&1; then
  echo "FAIL  a blocked reader could comment"; exit 1
fi
echo "ok    a blocked reader cannot comment"
docker/moderate.sh unblock "$uid"

# 5. Restore.
docker/restore.sh "$file"
wait_for "the restored comment is back on the page" "curl -s '$SITE$PAGE' | grep -q '$MARK'"
