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

* **[E]** Webmentions are sent, because the network does not work otherwise.
* **[V]** Sending happens only after the new build is served. The receiver
  fetches the source URL and checks the link.
* **[V]** The sent pairs of source and target are stored, so not all pings go
  out again on every rebuild. If a post changes, it is sent again. If a post is
  removed, a deletion notice is sent.
* **[V]** Looking up the endpoint of the targets fetches foreign servers and
  runs asynchronously to the build, with time limits.
* The implementation of the sender is open (O11).

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
