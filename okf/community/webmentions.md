---
type: Feature
title: Webmentions
description: Receiving through webmention.io, sending from posts and memos, display as Remark42 comments.
tags: [webmention, indieweb, remark42]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
sources:
  - id: remark42-create
    resource: https://raw.githubusercontent.com/umputun/remark42/master/backend/app/rest/api/rest_private.go
    title: Remark42 createCommentCtrl
  - id: remark42-comment
    resource: https://raw.githubusercontent.com/umputun/remark42/master/backend/app/store/comment.go
    title: Remark42 Comment, PrepareUntrusted
  - id: remark42-migrator
    resource: https://raw.githubusercontent.com/umputun/remark42/master/backend/app/migrator/native.go
    title: Remark42 native import
---

# Decisions

* **[E]** webmention.io receives mentions.
* **[E]** Mentions are also sent, from posts. Whether from memos is an
  assumption (O12).
* **[E]** Mentions can arrive for posts and memos.
* **[E]** Display as comments in Remark42 (option B), so comments and mentions
  are in one timeline in the widget.
* **[E]** The name of the source page as commenter and the original date are
  not feasible. What Remark42 allows applies.
* **[E]** The browser loads nothing from webmention.io.

# Why as comments

The Remark42 widget cannot be extended from outside with foreign entries. An
import path would be possible, but it deletes all comments of the site on every
run (`DeleteAll` before writing).[^remark42-migrator] It is therefore not
acceptable.

# Procedure (proposal)

* **[V]** The builder queries webmention.io every 3 minutes.
* **[V]** For every new mention it posts a comment through
  `POST /api/v1/comment` with basic auth as `admin` into the topic of the
  target page.
* **[V]** The comment text contains Markdown with the name and the link of the
  source page, for example "Mention from {site name}: {URL}". The texts are
  sanitized beforehand (see [Sanitizing](/security/sanitization.md)). Whether
  links in Remark42 comments are rendered this way has not been checked.
* **[V]** The builder stores the mapping from mention to comment id, so it does
  not post twice and can delete the comment through
  `DELETE /api/v1/admin/comment/{id}` when a mention is gone. Recovery when the
  state is lost: see O3.

# What Remark42 dictates

* The author is always the logged-in user, here `admin`. A name of its own is
  not possible.[^remark42-create]
* The timestamp is reset and assigned anew, the time of posting counts.[^remark42-comment]
  So the time of a mention is the time of arrival (up to 3 minutes after it
  arrives), not the date of the source page. On the first run existing mentions
  would get the current date.
* **[U]** How the widget displays the author `admin` has not been checked.

# Sending

Decided by the owner on 2026-11-04 (W15). Sending is **off by default**
(`MUFFEL_WEBMENTIONS_SEND`, see [Defaults stay inside](/ops/defaults.md)).

* **[E]** Webmentions are sent, because the network does not work otherwise.
  W15 does not wait for W14: sending needs only `SITE_URL` and the `h-entry`
  markup of the pages. Without `SITE_URL` the sender refuses to run with a clear
  message (no relative source URLs).
* **[E]** Which entries send: posts, memos and terms (O12 decided).
* **[E]** Own small module, no library, no external service (O11 decided):
  endpoint discovery by the W3C rules (HTTP `Link` header, then `<link>` and
  `<a>` with `rel="webmention"`), POST `application/x-www-form-urlencoded` with
  `source` and `target`. Success is any 2xx.
* **[E]** Targets: every external `http(s)` link in the content of the entry
  (`.e-content` of the `h-entry`) except the hosts of a block list
  (`MUFFEL_WEBMENTIONS_BLOCK`, comma separated, empty by default). The own
  domain, non-`http(s)` links, links with credentials and private or local
  addresses are never targets.
* **[E]** The sender reads the **built pages** of the release that just went
  online, not the Markdown: that is exactly what the receiver will fetch.
  Sending starts only after `current` points at the new release.
* **[E]** A change of the content of an entry (hash) sends again to all its
  targets. If a link is removed from an entry, or the entry is gone, the same
  notification is sent to that target once more; the receiver sees that the
  link or the page is gone (this is how the specification handles deletion).
* **[E]** First activation: the current state is stored as "already sent"
  without sending anything. Only new and changed entries are sent afterwards.
  A command sends the existing entries on purpose.
* **[E]** Change of the site address (the origin of `SITE_URL`): the state holds
  the origin it was made under. On a change every entry would look new and
  every link would be reported again, so the sender behaves like at the first
  start: it stores the entries under the new address without sending, and
  forgets the pairs of the old address (also failed ones). Decided on 2026-11-05
  as a consequence of "no flood"; a state from before the origin was stored is
  accepted without a reset.
* **[E]** Limits, all adjustable by variable: 10 s per request, 1 MB read per
  response, at most 10 targets per entry, one request per second, at most 3
  redirects (each one checked again). A failed pair is tried up to 3 times over
  later builds, then given up.
* **[E]** Host memory: a host without an endpoint is not asked again for 30
  days, a found endpoint is reused for 7 days. Timeouts and server errors are
  not remembered.
* **[E]** Safety of the requests: only `http` and `https`, no credentials in
  the URL, the host name is resolved and every address is checked (loopback,
  private, link-local, carrier-grade NAT, metadata addresses, IPv4-mapped
  IPv6), and the connection uses exactly the checked address (no DNS
  rebinding). `MUFFEL_WEBMENTIONS_ALLOW_PRIVATE=1` lifts the address check and
  exists only for tests and the tutorial (local receiver).
* **[E]** Visibility: one log line per sent pair, the file `state/webmentions.json`
  (pairs with time, status, attempts) and counters in `state/status.json`. A
  pair that was given up also goes to the alert webhook
  (`MUFFEL_ALERT_WEBHOOK`). A failure never fails a build.

# Prerequisites

* **[V]** `<link rel="webmention" href="https://webmention.io/<domain>/webmention">`
  and `rel=me` links in the `<head>` or on the page, IndieAuth login at
  webmention.io. This needs the final domain.
* **[V]** Microformats (`h-entry`, `h-card`, `u-url`) on post and memo pages,
  so receivers can read title and author. This was not discussed (O11).
* **[U]** The public webmention.io API delivers mentions without a token and
  has a `since` parameter. Not checked.

# Risks

* Mentions are foreign content. Spam and malicious code: text is rendered only
  as text.
* If webmention.io fails, existing mentions must not disappear. They live in
  Remark42 and stay there.
* `ADMIN_PASSWD` in the builder is a master key (see
  [Comments](/community/comments.md)).

[^remark42-create]: Remark42 createCommentCtrl
[^remark42-comment]: Remark42 Comment, PrepareUntrusted
[^remark42-migrator]: Remark42 native import
