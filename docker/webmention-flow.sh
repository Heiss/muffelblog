#!/bin/sh
# With MUFFEL_WEBMENTIONS_SEND=1 the first start stores the existing entries as
# already sent and sends nothing. Needs the running demo stack with the switch on.
set -eu
cd "$(dirname "$0")/.."

i=0
until docker compose exec -T builder cat /data/state/status.json | grep -q '"webmentions"'; do
  i=$((i+1))
  if [ $i -ge 30 ]; then
    echo "FAIL  status.json has no webmentions section"
    docker compose logs --no-color --tail 15 builder
    exit 1
  fi
  sleep 2
done
echo "ok    status.json reports the webmentions"

list="$(docker/webmentions.sh list)"
echo "$list"
echo "$list" | grep -q '^0 pairs, [1-9][0-9]* entries known' || { echo "FAIL  expected no pairs and known entries"; exit 1; }
echo "ok    the existing entries are known, nothing was sent"

if docker compose logs --no-color builder | grep -q 'webmention sent'; then
  echo "FAIL  the builder sent a webmention at the first start"; exit 1
fi
echo "ok    no webmention was sent"
