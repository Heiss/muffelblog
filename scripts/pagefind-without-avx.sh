#!/bin/sh
# Builds the search index of apps/site/dist on an emulated CPU without AVX
# (Nehalem: SSE4.2, like the Celeron J4105 of a home server). Pagefind 1.6.0
# stopped with "Illegal instruction" there, and its npm wrapper only says
# "exit 1". Needs qemu-user (qemu-x86_64) and a built apps/site/dist.
set -eu
dir=$(readlink -f apps/site/node_modules/pagefind)/..
bin="$dir/@pagefind/linux-x64/bin/pagefind_extended"
test -x "$bin"
qemu-x86_64 -cpu Nehalem-v1 "$bin" --site apps/site/dist
echo "ok    the search index builds on a CPU without AVX"
