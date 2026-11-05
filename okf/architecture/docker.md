---
type: Deployment
title: Docker operation
description: Services, networks, volumes, secrets and release swap of the Docker delivery.
tags: [docker, operations, caddy, remark42]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Decision

**[E]** Everything is delivered through Docker, on one server.

# Implemented in release 26.11.0 (W11, 2026-11-03)

* **[E]** `compose.yaml` at the repo root with `builder` (one-shot: builds into
  a new release folder, `build.json` last, atomic swap of `current`, last good
  version stays online on failure, newest `MUFFEL_RELEASES_KEPT` kept),
  `web` (Caddy 2.11, `docker/Caddyfile`), `remark42` (v1.18.0) and `mailpit`
  (v1.33, local mail sink, demo only since 2026-11-05). The scheduler (every 3
  minutes, W12) is part of 26.11.0.
* **[E]** Remark42 gets a host of its own (port 8081 of our Caddy)
  instead of a path; requests with `Authorization: Basic` are answered with 403
  and the header is never passed on. The site blocks keep a strict CSP; the
  comments host only gets the hardening headers because Remark42 brings its own
  scripts and styles.
* **[E]** CSP of the site: `default-src 'none'`, `script-src 'self'
  'wasm-unsafe-eval'` (Pagefind), `style-src 'self'`, images only from the hosts
  of `policy.ts`, frames only from the embed hosts. A unit test keeps the
  Caddyfile and `policy.ts` in sync; Astro is configured to emit no inline
  scripts or styles (E2E test). Checked against a real Caddy with a browser:
  no violations on feed, article, term, memo and search.
* **[E]** Secrets come from `.env` (created by `docker/init-env.sh`, not
  committed); `REMARK_SECRET` and `REMARK_ADMIN_PASSWD` are required.
* **[E]** The builder runs as the user `node` (uid 1000), not as root (W16,
  decided by the owner); `heif-convert` (libheif) is installed in its image.
* **[E]** CI job "Compose stack" builds the images, starts the stack and runs
  `docker/smoke.sh`.

# Setup (2026-11-05, replaces the variants of 2026-11-04)

* **[E]** (decided by the owner) `compose.yaml` alone is the production setup
  behind the operator's reverse proxy: `docker/init-env.sh`, fill in `.env`,
  `docker compose up -d`. Our Caddy stays (owner: Caddy, not nginx) and serves
  plain HTTP on `127.0.0.1:8080` (blog) and `:8081` (comments); the proxy only
  adds HTTPS and forwards. Headers, cache rules, 404 and the Basic-auth block
  stay inside our Caddy.
* **[E]** Required values fail at `docker compose up` (`${VAR:?}`): `SITE_URL`,
  `COMMENTS_URL`, `MAIL_FROM`, `REMARK_ADMIN_EMAIL`, `SMTP_HOST`, `SMTP_PORT`,
  the Remark42 secrets. The sources are checked by the builder at its start.
  `SMTP_USERNAME`/`SMTP_PASSWORD` are optional (relays without login).
* **[E]** Visitor address: Caddy believes `X-Forwarded-For` only from
  `MUFFEL_TRUSTED_PROXIES` (default `private_ranges`) and reads it from the
  right (`trusted_proxies_strict`), then sets `X-Real-IP` for Remark42.
* **[E]** `compose.demo.yaml`: Mailpit for the local demo and CI;
  `docker/init-env.sh --demo` writes local values, `MUFFEL_FIXTURES=demo` and
  `COMPOSE_FILE=compose.yaml:compose.demo.yaml` into `.env`.
* **[E]** `compose.host-folder.yaml` (advanced, owner: offer both): the proxy
  serves the host folder `MUFFEL_RELEASES_DIR` itself, our `web` is not started,
  Remark42 on `127.0.0.1:${REMARK_PORT}`.
* **[E]** `compose.domain.yaml` (our Caddy with automatic HTTPS) is removed; the
  docs link the Caddy quick start for operators without a proxy. The 4-chapter
  tutorial is folded into Getting started and the guides.
* **[E]** The Docker health check of `web` asks a port that exists only inside
  the container (`:2020/healthz`).
* **[U]** Not run for real: the setup behind a real proxy with a domain and
  certificate, and the nginx/Traefik snippets. CI starts the demo stack and
  checks the production files with `config -q`, including that a missing
  `SITE_URL` is named.
* **Found while rebuilding:** in the removed variants with our Caddy
  (`compose.domain.yaml`, profile `own-caddy`) the web service did not get
  `COMMENTS_URL`, so its CSP named `http://localhost:8081` and would have
  blocked the comment widget. `compose.yaml` now passes it, a test checks it.

# Services (proposal)

**[V]** Three containers in one Compose file:

| Service | Content | Network |
|---|---|---|
| `web` | Caddy: TLS, static delivery, reverse proxy to Remark42 | internal + public |
| `builder` | Node/Astro, Pagefind, rclone, scheduler, mention sync, mention sending | internal |
| `remark42` | Comments, email login | internal |

Memos and Nextcloud run externally or already exist and are not part of the
Compose file.

# Volumes (proposal)

* `releases`: build outputs `releases/<build-id>/` plus the symlink `current`,
  read by `web`, written by the `builder`.
* `state`: state of the builder (last seen states, sent webmentions, mapping
  of mention to comment).
* `remark42-var`: database and backups of Remark42 (persistent, backed up).
* `cache`: cache for mirrored images and the sync state.

# Release swap (proposal)

* Build into a new directory `releases/<id>/`.
* `build.json` is written as the last file.
* Then switch the symlink `current` atomically (new symlink, then `rename`).
* The last N releases are kept (proposal: 3), so open tabs can still load
  their hashed assets.

# Reverse proxy rules (proposal)

* `Authorization: Basic ...` is rejected on all public routes of Remark42. The
  builder talks to Remark42 directly in the internal network.
* Caddy sets a strict Content Security Policy: `script-src 'self'`. `img-src`
  contains `'self'` and the image hosts from `policy.ts`, `frame-src` the hosts
  of the embed rules. The widget comes from the own host. The hosts are
  generated from the same list as the check in the build.
* `build.json` is served with `Cache-Control: no-cache` and ETag, so
  conditional requests answer with 304. All other assets are hashed and can be
  cached for a long time.

# Secrets and environment variables

**[E]** The sender address for login mails comes from an environment variable.

**[E]** The build of the site reads `CONTENT_DIR` (synchronized Nextcloud
folder) and `MEMOS_URL` (address of the Memos instance, reachable internally).
If one of the two is missing, the build stops. The numeric settings and the
UI language are environment variables as well (see
[Configuration](/ops/config.md) and [Languages](/ops/language.md)).

**[V]** Secrets not in the repo, but as Docker secrets or `.env` on the
server:

* Nextcloud: share token and share password
* Memos: URL (and a token if attachments require it)
* Remark42: `SECRET`, `ADMIN_PASSWD`, `AUTH_EMAIL_FROM`, `SMTP_*`
* webmention.io: credentials, if the API needs them

`ADMIN_PASSWD` is a master key (see [Comments](/community/comments.md)) and
lives only in the `builder` and in `remark42`.

# Image versions

**[E]** For Memos and Nextcloud the user wants "always the newest".
**[V]** For the own containers (Remark42, Caddy, Node base) tags or digests
are pinned, because an unnoticed update can break the build or the API. The
contradiction with "always newest" is recorded in
[Open points](/open-points.md) as O8.

# Open

O9 (reverse proxy, domain, host name of Remark42), O10 (image build on the
server or through a registry), O18 (backup, monitoring).
