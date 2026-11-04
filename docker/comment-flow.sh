#!/bin/sh
# End to end: a comment written in Remark42 shows up as static copy in the page,
# built by the scheduler. Needs a running stack with a short check interval
# (MUFFEL_CHECK_INTERVAL_SECONDS=10, MUFFEL_DEBOUNCE_CHECKS=1) and the demo set.
# Usage: docker/comment-flow.sh [site-url]
set -eu
SITE="${1:-http://localhost:8080}"
PAGE="/p/statischer-blog/"
MARK="Kommentar-vom-Test-$(date +%s)"
cd "$(dirname "$0")/.."
PASSWORD="$(sed -n 's/^REMARK_ADMIN_PASSWD=//p' .env)"

echo "page before: $(curl -s "$SITE$PAGE" | grep -c "$MARK") hits (expect 0)"

# Written from inside the network with the admin login, like an operator would.
docker compose exec -T -e PW="$PASSWORD" -e URL="$SITE$PAGE" -e MARK="$MARK" builder node -e '
  const auth = "Basic " + Buffer.from("admin:" + process.env.PW).toString("base64");
  fetch("http://remark42:8080/api/v1/comment", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ text: process.env.MARK, locator: { site: "muffelblog", url: process.env.URL } }),
  }).then(async (r) => { if (r.status !== 201) { console.error(r.status, await r.text()); process.exit(1); } });
'

i=0
until curl -s "$SITE$PAGE" | grep -q "$MARK"; do
  i=$((i+1))
  if [ $i -ge 60 ]; then
    echo "FAIL  the comment did not reach the page in 3 minutes"
    docker compose logs --no-color --tail 40 builder
    exit 1
  fi
  sleep 3
done
echo "ok    the comment is in the static copy of $PAGE"
curl -s "$SITE$PAGE" | grep -q 'data-comments-static' && echo "ok    marked as static copy"
