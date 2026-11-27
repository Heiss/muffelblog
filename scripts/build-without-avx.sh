#!/bin/sh
# Builds the site from the fixtures with Astro on an emulated CPU without AVX
# (Nehalem: SSE4.2, like the Celeron J4105 of a home server). The native Astro
# compiler @astrojs/compiler-rs 0.5.3 stopped there with "Illegal instruction"
# (withastro/compiler-rs#220), the builder only logged "exited with null". All
# native modules on the way of the build (compiler, Rolldown, sharp,
# lightningcss) run under the emulation; the GitHub runners themselves have AVX2.
# Needs qemu-user (qemu-x86_64) and installed dependencies.
set -eu
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT
cd apps/site
MUFFEL_FIXTURES=1 MUFFEL_FEED_PAGE_SIZE=4 COMMENTS_URL=http://localhost:4322 \
  qemu-x86_64 -cpu Nehalem-v1 "$(command -v node)" \
  node_modules/astro/bin/astro.mjs build --outDir "$out"
test -f "$out/index.html"
echo "ok    the site builds on a CPU without AVX"
