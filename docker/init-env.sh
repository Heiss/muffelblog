#!/bin/sh
# Creates .env from .env.example with fresh random secrets (does not overwrite).
set -eu
cd "$(dirname "$0")/.."
if [ -e .env ]; then
  echo ".env exists, nothing changed"
  exit 0
fi
secret() { head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }
sed -e "s/^REMARK_SECRET=.*/REMARK_SECRET=$(secret)/" \
    -e "s/^REMARK_ADMIN_PASSWD=.*/REMARK_ADMIN_PASSWD=$(secret)/" \
    .env.example > .env
chmod 600 .env
echo ".env created"
