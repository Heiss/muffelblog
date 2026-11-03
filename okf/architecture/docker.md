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
