---
type: Feature
title: Comments with Remark42
description: Self-hosted comments with email login, widget and a static copy.
tags: [comments, remark42, smtp, migadu]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
sources:
  - id: remark42-docs
    resource: https://github.com/umputun/remark42/tree/master/site/content/docs
    title: Remark42 documentation in the repository
  - id: remark42-api
    resource: https://raw.githubusercontent.com/umputun/remark42/master/site/content/docs/contributing/api/index.md
    title: Remark42 REST API
  - id: remark42-create
    resource: https://raw.githubusercontent.com/umputun/remark42/master/backend/app/rest/api/rest_private.go
    title: Remark42 createCommentCtrl
  - id: pkgz-auth
    resource: https://raw.githubusercontent.com/go-pkgz/auth/master/middleware/auth.go
    title: go-pkgz/auth middleware with admin basic auth
---

# Decisions

* **[E]** Remark42 as the self-hosted solution, no GitHub dependency.
* **[E]** Comments on posts, memos and glossary terms (terms since 2026-11-05, O38). No comments on the Memos instance
  itself.
* **[E]** Login only by email, no anonymous commenting, no social logins.
* **[E]** The widget is active and loads from the own server. In addition
  there is a static copy of the comments in the HTML for SEO and for visitors
  without JavaScript.
* **[E]** SMTP through Migadu. The sender address comes from an environment
  variable.
* **[E]** Webmentions appear as entries in the same timeline (see
  [Webmentions](/community/webmentions.md)).

# Configuration

* `AUTH_EMAIL_ENABLE=true`, `AUTH_EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`,
  `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_TLS` or
  `SMTP_STARTTLS`.[^remark42-docs]
* `AUTH_ANON` is off by default. OAuth providers are active only if their
  client id is set. Do not set any ids.[^remark42-docs]
* `ADMIN_PASSWD` enables basic auth for the user `admin`. It is off by
  default.[^remark42-docs]
* **[U]** For Migadu `smtp.migadu.com` with port 465 (TLS) or 587 (STARTTLS) is
  usual. The sender must be a mailbox or alias of the domain, SPF, DKIM and
  DMARC must be set. Not checked.
* **[V]** The widget gets `host`, `site_id` and `url` (canonical URL of the
  page). The path of the page is the key of the comments.

# Implemented: static copy (W13, 2026-11-04)

* **[E]** At build time the builder reads the comments through the public API
  at the **internal** address `REMARK_INTERNAL_URL` (`http://remark42:8080` in
  Compose): **one** request `GET /api/v1/last/1000?site`, grouped by page address
  in the builder. Remark42 limits the request rate (429), found by the CI when
  the first version asked once per page; the client now also waits and retries
  on 429. If the answer has 1000 entries it may be cut off, then single pages
  are asked for (`GET /api/v1/find?site&url&format=plain&sort=time`). The key is the canonical address (`SITE_URL` + path), the same the
  widget uses, so `SITE_URL` is required. The flat list becomes a tree (oldest
  first, replies below their comment, a missing parent promotes the reply to the
  top, loops are broken, deleted comments disappear unless they have replies,
  then only a placeholder stays).
* **[E]** The text goes through the same sanitizer as all content, without
  foreign images; author names are plain text. No avatars.
* **[E]** The copy is part of the HTML (readable without JavaScript) and steps
  aside (`hidden`) when the widget script has loaded; if the widget fails, the
  copy and a hint stay.
* **[E]** Change detection: the scheduler fingerprints
  `GET /api/v1/last/1000?site` every check, so a new, edited or deleted comment
  triggers a build (after the debounce). **[U]** Beyond the latest 1000 comments
  of the site a change to an old comment would not be noticed.
* **[E]** If Remark42 cannot be read, the build stops and the last good version
  stays online (reported by the scheduler). Without a release online a failed
  check is repeated after 10 seconds instead of 3 minutes, so a starting stack
  settles quickly.
* **[E]** Tests: unit tests (tree, sanitizing, fingerprint, client), E2E with a
  fixture file, a contract test against a real Remark42 (CI), and a flow test in
  the Compose job: a comment is written in Remark42 and must appear in the page.

# Moderation, hardening, backup (2026-11-04)

* **[E]** Facts checked in the Remark42 v1.18.0 documentation: `ADMIN_SHARED_EMAIL`
  (default `admin@<host of REMARK_URL>`, so it is set explicitly and required in
  production), `NOTIFY_ADMINS=email` with `NOTIFY_EMAIL_FROM`, `TRUSTED_PROXY`.
  Admin API with basic auth: `DELETE /api/v1/admin/comment/{id}?site&url`,
  `PUT /api/v1/admin/user/{id}?block=1|0&ttl`, `GET /api/v1/admin/export?mode=file`,
  `POST /api/v1/admin/import`, `GET /api/v1/admin/wait`.
* **[E]** `docker/moderate.sh` (list, delete, block, unblock), `docker/backup.sh`
  and `docker/restore.sh` use that API from inside the builder container
  (`apps/builder/src/remark-admin*.ts`). The CI flow `docker/moderation-flow.sh`
  writes a comment, checks the administrator mail, backs up, deletes the comment
  (it leaves the page), wipes the Remark42 data and restores the backup (the
  comment returns).
* **[E]** Restore only works into an empty Remark42: `BoltDB.Create` rejects ids
  that exist, also soft-deleted ones (Remark42 keeps a deleted comment as a shell
  in `last/1000`). Found in CI, confirmed in the Remark42 source.
* **[E]** Rate limit and client address: Remark42 keys its limits on `X-Real-IP`.
  Our Caddy overwrites it with `{client_ip}` (checked with an echo server: a
  spoofed `X-Real-IP` and `X-Forwarded-For` are replaced), and `TRUSTED_PROXY`
  defaults to `172.16.0.0/12` (the Docker networks). Remark42's port is published
  on `127.0.0.1` only. Consequence for other proxies: they must set `X-Real-IP`
  themselves (documented for Caddy and nginx; a plain Traefik does not).
* **[U]** Moderation in the browser interface (clicks as an administrator by
  email login) is from the documentation, not covered by a test.

# Reading for the build (original proposal)

`GET /api/v1/find?site=...&url=...` is public and needs no
authentication.[^remark42-api] The static copy is created from it and rendered
after [sanitizing](/security/sanitization.md).

# Moderation and spam

* **[V]** Moderation through the Remark42 interface as admin.
* An approved or new comment appears in the static copy only after the next
  scheduler run. In the widget immediately.
* The email addresses of the commenters are held by the operator (privacy, see
  O15).

# Admin access for scripts

Scripts authenticate with HTTP basic auth using the user `admin` and
`ADMIN_PASSWD`.[^pkgz-auth] The auth middleware sets the fixed identity
`admin`, also for `POST /api/v1/comment`.[^remark42-create]

* `ADMIN_PASSWD` is a master key. It also allows export and import under
  `/api/v1/admin/...`. An import replaces all comments of the site (see
  [Webmentions](/community/webmentions.md)).
* **[V]** The reverse proxy rejects requests with `Authorization: Basic` from
  outside (see [Docker](/architecture/docker.md)).
* **[E]** Checked 2026-11-04 against Remark42 v1.18.0 (contract test):
  `POST /api/v1/comment` with the admin basic auth works (201). The write
  endpoint is rate limited (429 "maximum request limit") when comments follow
  each other within about a second.

# Unconfirmed

* **[U]** The widget is attached to a `<div>` by script. Whether it uses an
  iframe is not stated in the pages that were read.
* **[U]** Default sorting in the widget (by time or rating) and whether the
  operator can set it: not checked (O4).
* **[U]** Operation under a path instead of a subdomain: not checked (O9).

[^remark42-docs]: Remark42 documentation in the repository
[^remark42-api]: Remark42 REST API
[^remark42-create]: Remark42 createCommentCtrl
[^pkgz-auth]: go-pkgz/auth middleware with admin basic auth
