#!/bin/sh
# Receiving webmentions in the demo: a mention arrives at the stand-in of
# webmention.io, the builder writes it into Remark42 as a comment, the comment
# reaches the page; then the mention is deleted and the comment disappears.
# Needs the running demo stack (docker/init-env.sh --demo).
set -eu
cd "$(dirname "$0")/.."
SITE="${1:-http://localhost:8080}"
STANDIN="${2:-http://localhost:8090}"
COMMENTS="${3:-http://localhost:8081}"

slug="$(curl -fsS "$SITE/entries.json" | grep -o '"id":"post:[^"]*"' | head -1 | cut -d: -f3 | tr -d '"')"
[ -n "$slug" ] || { echo "FAIL  no post found in entries.json"; exit 1; }
page="/p/$slug/"
target="$SITE$page"
host="mention-$(date +%s).example"
source="https://$host/post"

id="$(curl -fsS -X POST -H 'Content-Type: application/json' \
  -d "{\"source\":\"$source\",\"target\":\"$target\",\"property\":\"in-reply-to\",\"author\":\"Flow Test\"}" \
  "$STANDIN/_standin/mention" | grep -o '"id":[0-9]*' | cut -d: -f2)"
echo "ok    mention $id sent to the stand-in: $source -> $target"

wait_for() { # description, command
  i=0
  until sh -c "$2" >/dev/null 2>&1; do
    i=$((i+1))
    if [ $i -ge 60 ]; then
      echo "FAIL  $1"
      docker compose logs --no-color --tail 20 builder webmention-io
      exit 1
    fi
    sleep 2
  done
  echo "ok    $1"
}

wait_for "the builder wrote the mention into Remark42" \
  "curl -fsS '$COMMENTS/api/v1/find?site=muffelblog&url=$target&format=plain' | grep -q '$host'"
wait_for "the comment names the kind and the author" \
  "curl -fsS '$COMMENTS/api/v1/find?site=muffelblog&url=$target&format=plain' | grep -q 'Reply from Flow Test'"
wait_for "the mention reached the page itself (static copy)" \
  "curl -fsS '$target' | grep -q '$source'"

if docker compose logs --no-color builder | grep "webmention received" | grep -c "$source" | grep -qv '^1$'; then
  echo "FAIL  the mention was posted more than once"; exit 1
fi
echo "ok    posted exactly once"

curl -fsS -X POST -H 'Content-Type: application/json' -d "{\"id\":$id}" "$STANDIN/_standin/delete" >/dev/null
wait_for "the comment of the deleted mention is gone" \
  "! curl -fsS '$target' | grep -q '$source'"
