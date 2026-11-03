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
* **[E]** Comments on posts and memos. No comments on the Memos instance
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

# Reading for the build

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
* **[U]** Whether Remark42 sets its own `BasicAuthChecker` that switches off
  this path has not been checked.

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
