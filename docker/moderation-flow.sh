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
PASSWORD="$(sed -n 's/^REMARK_ADMIN_PASSWD=//p' .env)"
backups="$(mktemp -d)"
trap 'rm -rf "$backups"' EXIT

wait_for() { # description, shell test that must succeed
  i=0
  until sh -c "$2"; do
    i=$((i+1))
    if [ $i -ge 60 ]; then
      echo "FAIL  $1"
      docker compose logs --no-color --tail 40 builder
      exit 1
    fi
    sleep 3
  done
  echo "ok    $1"
}
on_page() { curl -s "$SITE$PAGE" | grep -q "$MARK"; }

# 1. A comment is written (as the administrator would, from inside the network).
docker compose exec -T -e PW="$PASSWORD" -e URL="$SITE$PAGE" -e MARK="$MARK" builder node -e '
  const auth = "Basic " + Buffer.from("admin:" + process.env.PW).toString("base64");
  fetch("http://remark42:8080/api/v1/comment", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ text: process.env.MARK, locator: { site: "muffelblog", url: process.env.URL } }),
  }).then(async (r) => { if (r.status !== 201) { console.error(r.status, await r.text()); process.exit(1); } });
'
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

# 5. Restore.
docker/restore.sh "$file"
wait_for "the restored comment is back on the page" "curl -s '$SITE$PAGE' | grep -q '$MARK'"
