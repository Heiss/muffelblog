---
title: Production overview
description: Pick the setup that fits your server and what to prepare.
---

Three ways to run it. They all use the same images and the same builder.

|            | Local demo                | Own reverse proxy                              | Own Caddy with a domain                |
| ---------- | ------------------------- | ---------------------------------------------- | -------------------------------------- |
| Files      | `compose.yaml`            | `compose.yaml` + `compose.production.yaml`     | `compose.yaml` + `compose.domain.yaml` |
| Web server | our Caddy, plain HTTP     | **yours** (nginx, Caddy, Traefik, ...)         | our Caddy, HTTPS by itself             |
| Releases   | Docker volume             | **folder on the host**, shared with your proxy | Docker volume                          |
| Mail       | Mailpit (nothing is sent) | your SMTP server                               | your SMTP server                       |
| For        | trying it out             | a server that already has a proxy              | a server without one                   |

Choose [your own reverse proxy](/muffelblog/production/own-proxy/) when something
else already owns ports 80 and 443. Choose
[our Caddy](/muffelblog/production/own-caddy/) when this machine only runs the blog.

## Before you start

- A domain with DNS records for **two names**: the blog (`blog.example.org`) and the
  comments (`comments.example.org`). Comments run on a host of their own.
- Real content sources: [Nextcloud](/muffelblog/guides/nextcloud/) and
  [Memos](/muffelblog/guides/memos/).
- A mail server for the login mails.
- `.env` with the settings below. Create it with `docker/init-env.sh`.

```sh
SITE_URL=https://blog.example.org
COMMENTS_URL=https://comments.example.org
MUFFEL_FIXTURES=
```

`SITE_URL` makes canonical addresses, the sitemap, RSS and the comment keys
absolute. **Decide it early**: comments and RSS identifiers depend on the address.
Remark42 can move comments to a new address, but webmentions (planned) cannot be
moved.

## HTTPS and HSTS

Once HTTPS works, consider `Strict-Transport-Security` at your proxy (the examples
leave it out because the same configuration also serves plain HTTP in the demo).
Start with a short `max-age`, for example `300`, and raise it later: browsers
remember the header, and it cannot be undone from the server.

## What every setup must do

1. Serve the files of `current/` for the blog host.
2. Send these headers on the blog host (the Content Security Policy keeps the
   page from loading anything foreign):
   - `Content-Security-Policy`, exactly as in the example for your proxy
   - `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`
3. Cache `/_astro/*` for a long time (the files carry a hash in their name) and
   serve `/build.json`, `/health.json` and `/entries.json` with
   `Cache-Control: no-cache`.
4. Answer unknown pages with `404.html` and status 404.
5. Forward the comments host to Remark42 and **refuse requests that carry
   `Authorization: Basic ...`**. That header is the administrator login; it must
   never be accepted from the internet.
