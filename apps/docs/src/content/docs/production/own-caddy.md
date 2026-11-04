---
title: Our Caddy with a domain
description: Let the bundled Caddy serve the blog and fetch HTTPS certificates by itself.
---

Use this when the machine only runs the blog. Caddy answers on ports 80 and 443
and gets its certificates from Let's Encrypt automatically.

## 1. Prepare

- DNS `A`/`AAAA` records for `blog.example.org` and `comments.example.org` that
  point at this machine.
- Ports **80 and 443** (TCP and UDP for HTTP/3) free and open in the firewall.
  Port 80 is needed for the certificate challenge.

In `.env`:

```sh
SITE_ADDRESS=blog.example.org
COMMENTS_ADDRESS=comments.example.org
SITE_URL=https://blog.example.org
COMMENTS_URL=https://comments.example.org
MUFFEL_FIXTURES=
NEXTCLOUD_URL=...
NEXTCLOUD_SHARE_TOKEN=...
NEXTCLOUD_SHARE_PASSWORD=...
MEMOS_URL=...
MAIL_FROM=blog@example.org
REMARK_ADMIN_EMAIL=you@example.org          # the comment administrator, see Comments
SMTP_HOST=smtp.example.org
SMTP_PORT=465
SMTP_USERNAME=blog@example.org
SMTP_PASSWORD=...
```

## 2. Start

```sh
docker compose -f compose.yaml -f compose.domain.yaml up -d
```

`compose.domain.yaml` makes both host names mandatory, publishes 80, 443 and
443/udp instead of the local ports, requires a real mail server and does not
start Mailpit. The certificates live in the volume `caddy-data`; keep it, or
Caddy asks for new ones after every re-creation and you may hit the rate limits
of Let's Encrypt.

## 3. Check

- `https://blog.example.org/build.json` answers with the build id.
- `https://comments.example.org/ping` answers `pong`; with
  `-H 'Authorization: Basic YTpi'` it answers **403**.

:::note[Not tested with a real domain]
The configuration is validated with a host name and the merged Compose files are
checked in CI, but the project cannot obtain a real certificate in its tests.
Report problems on GitHub.
:::
