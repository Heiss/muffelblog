#!/bin/sh
# Creates .env from .env.example with fresh random secrets (does not overwrite).
#
#   docker/init-env.sh          production: fill in the rest of .env yourself
#   docker/init-env.sh --demo   local demo: sample content, mails go to Mailpit
set -eu
cd "$(dirname "$0")/.."
if [ -e .env ]; then
  echo ".env exists, nothing changed"
  exit 0
fi
secret() { head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }
umask 077
sed -e "s/^REMARK_SECRET=.*/REMARK_SECRET=$(secret)/" \
    -e "s/^REMARK_ADMIN_PASSWD=.*/REMARK_ADMIN_PASSWD=$(secret)/" \
    .env.example > .env
if [ "${1:-}" = "--demo" ]; then
  # The required values get local addresses; nothing leaves this machine.
  sed -i.bak \
    -e 's|^SITE_URL=.*|SITE_URL=http://localhost:8080|' \
    -e 's|^COMMENTS_URL=.*|COMMENTS_URL=http://localhost:8081|' \
    -e 's|^MAIL_FROM=.*|MAIL_FROM=blog@localhost|' \
    -e 's|^REMARK_ADMIN_EMAIL=.*|REMARK_ADMIN_EMAIL=admin@localhost|' \
    -e 's|^SMTP_HOST=.*|SMTP_HOST=mailpit|' \
    -e 's|^SMTP_PORT=.*|SMTP_PORT=1025|' \
    -e 's|^SMTP_TLS=.*|SMTP_TLS=false|' \
    .env
  rm -f .env.bak
  printf '\n# Demo (docker/init-env.sh --demo)\nCOMPOSE_FILE=compose.yaml:compose.demo.yaml\nMUFFEL_FIXTURES=demo\n' >> .env
  echo ".env created for the demo: docker compose up --build"
else
  echo ".env created: fill in the values marked as required, then docker compose up -d"
fi
