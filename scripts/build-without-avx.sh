#!/bin/sh
# Builds the site from the fixtures with Astro on an emulated CPU without AVX
# (Denverton, a Goldmont Atom: SSE4.2, AES, SHA, MOVBE, no AVX, no BMI; close
# to the Goldmont Plus Celeron J4105 of a home server). The native Astro
# compiler @astrojs/compiler-rs 0.5.3 stopped there with "Illegal instruction"
# (withastro/compiler-rs#220), the builder only logged "exited with null". All
# native modules on the way of the build (compiler, Rolldown, sharp,
# lightningcss) run under the emulation; the GitHub runners themselves have AVX2.
# Needs qemu-user (qemu-x86_64) and installed dependencies. The CI runs it in
# node:26-slim, the base image of the builder (see ci.yml).
set -eu
# The Atom generation of the J4105; Nehalem (as for Pagefind) lacks instructions
# the J4105 has (MOVBE, AES, SHA), and those are no reason to fail.
cpu=Denverton-v3
# The Node executable itself, not a wrapper script that may come first in PATH.
node=$(node -p 'process.execPath')
echo "node  $node $("$node" -v), $(qemu-x86_64 --version | head -n 1)"
# Node has to start on the emulated CPU, otherwise the build says nothing.
qemu-x86_64 -cpu "$cpu" "$node" -e 'process.exit(0)'
echo "ok    node starts on the emulated CPU ($cpu)"
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT
cd apps/site
MUFFEL_FIXTURES=1 MUFFEL_FEED_PAGE_SIZE=4 COMMENTS_URL=http://localhost:4322 \
  qemu-x86_64 -cpu "$cpu" "$node" \
  node_modules/astro/bin/astro.mjs build --outDir "$out"
test -f "$out/index.html"
echo "ok    the site builds on a CPU without AVX"
