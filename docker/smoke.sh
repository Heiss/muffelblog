#!/bin/sh
# Smoke test of a running compose stack (see compose.yaml). Usage:
#   docker/smoke.sh [site-url] [comments-url] [mail-url]
set -eu
SITE="${1:-http://localhost:8080}"
COMMENTS="${2:-http://localhost:8081}"
MAIL="${3:-http://localhost:8025}"
fail=0

check() { # name, expected, actual
  if [ "$2" = "$3" ]; then echo "ok    $1"; else echo "FAIL  $1: expected $2, got $3"; fail=1; fi
}
status() { curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$@" || true; }

# The stack may still be starting (builder, Remark42).
i=0
until [ "$(status "$SITE/build.json")" = "200" ] || [ $i -ge 60 ]; do i=$((i+1)); sleep 2; done

check "site answers"                 200 "$(status "$SITE/")"
check "build.json"                   200 "$(status "$SITE/build.json")"
# health.json is written at every check, give the first check a moment.
i=0
until [ "$(status "$SITE/health.json")" = "200" ] || [ $i -ge 30 ]; do i=$((i+1)); sleep 2; done
check "health.json"                  200 "$(status "$SITE/health.json")"
health="$(curl -s --max-time 10 "$SITE/health.json" || true)"
case "$health" in *'"state": "ok"'*) echo "ok    health.json says ok" ;; *) echo "FAIL  health.json: $health"; fail=1 ;; esac
case "$health" in *'"message"'*) echo "FAIL  health.json shows an error text"; fail=1 ;; *) echo "ok    health.json has no error text" ;; esac
hcache="$(curl -sI --max-time 10 "$SITE/health.json" | grep -i '^cache-control:' || true)"
case "$hcache" in *no-cache*) echo "ok    health.json is not cached" ;; *) echo "FAIL  health.json cache header: $hcache"; fail=1 ;; esac
check "search index"                 200 "$(status "$SITE/pagefind/pagefind.js")"
check "RSS feed"                     200 "$(status "$SITE/feed.xml")"
check "sitemap"                      200 "$(status "$SITE/sitemap.xml")"
check "robots.txt"                   200 "$(status "$SITE/robots.txt")"
check "unknown page gives 404"       404 "$(status "$SITE/gibt-es-nicht/")"
check "term page"                    200 "$(status "$SITE/g/abbund/")"

csp="$(curl -sI --max-time 10 "$SITE/" | grep -i '^content-security-policy:' || true)"
case "$csp" in *"script-src 'self'"*) echo "ok    CSP is set" ;; *) echo "FAIL  CSP missing: $csp"; fail=1 ;; esac
case "$csp" in *"unsafe-inline"*) echo "FAIL  CSP allows unsafe-inline"; fail=1 ;; *) echo "ok    CSP has no unsafe-inline" ;; esac

# Remark42 (may need a little longer), basic auth from outside is refused.
i=0
until [ "$(status "$COMMENTS/ping")" = "200" ] || [ $i -ge 30 ]; do i=$((i+1)); sleep 2; done
check "Remark42 answers"             200 "$(status "$COMMENTS/ping")"
check "basic auth is refused"        403 "$(status -H 'Authorization: Basic YWRtaW46eA==' "$COMMENTS/ping")"

# Login only by email: no anonymous, no social providers.
providers="$(curl -s --max-time 10 "$COMMENTS/api/v1/config?site=muffelblog" || true)"
case "$providers" in
  *'"auth_providers":["email"]'*) echo "ok    login only by email" ;;
  *) echo "FAIL  auth providers are not only email: $providers"; fail=1 ;;
esac

check "mail sink"                    200 "$(status "$MAIL/")"

exit $fail
