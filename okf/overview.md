---
type: Specification
title: Muffelblog - overview and goals
description: Purpose, scope and legend of the specification for the static blog with a Memos microblog.
tags: [blog, astro, memos, nextcloud, docker]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Purpose

A flat, personal blog. Articles are written as Markdown in a Nextcloud folder
(edited with Obsidian). Short messages come from a Memos instance. Both appear
in one combined, time-sorted feed. The site is generated statically and served
with Docker.

# Legend of the markers

This specification separates what is confirmed from proposals:

* **[E]** Decision: explicitly confirmed by the user.
* **[V]** Proposal: added by the assistant, not confirmed.
* **[U]** Unverified: a factual claim about software that is not proven and
  must be checked before implementation.

# Fixed key points

* **[E]** Generator: Astro, static. Client code in vanilla TS without a
  framework.
* **[E]** Source of the articles: Nextcloud public share (with a password),
  root folder, access through WebDAV. Nextcloud is the only source, no content
  in Git.
* **[E]** Only what carries `publish: true` is published.
* **[E]** Memos (public) are fetched at build time and get pages of their own.
* **[E]** Combined feed, purely chronological, endless scroll, one stream with
  a filter (the split view is dropped).
* **[E]** Glossary and knowledge graph, see [Glossary](/features/glossary.md).
* **[E]** Auto-update through `build.json`, banner "N new entries".
* **[E]** Search with Pagefind, tags, combined RSS feed.
* **[E]** Comments: Remark42 with email login, for posts and memos.
* **[E]** Webmentions: webmention.io, receiving and sending, displayed as
  comments in Remark42.
* **[E]** UI language per deployment setting (`en` default, or `de`); the
  content of the owner's blog is German. The domain is set later. Development is in English (see
  [Languages](/ops/language.md)).
* **[E]** Operation entirely in Docker: `compose.yaml` behind the operator's
  reverse proxy (see [Docker](/architecture/docker.md)).
* **[E]** License MIT, holder "Muffelblog contributors" (`LICENSE`, decided by
  the owner 2026-11-05).
* **[E]** Webmentions: sending is built (W15, off by default); receiving (W14)
  is not built yet (see [Open points](/open-points.md), A).

# Non-goals

* No wikilinks. Linking uses Markdown links. A graph built from these links is
  a goal (see [Glossary](/features/glossary.md)), a digital garden with
  wikilinks is not.
* No comments on the Memos instance itself.
* No run-time requests from the browser to third-party services. Exception:
  articles with remote images and embeds from allowlists (see
  [Media](/content/media.md)).

# Structure

* Architecture: [System](/architecture/system.md),
  [Docker](/architecture/docker.md)
* Content: [Nextcloud](/content/nextcloud-source.md),
  [Frontmatter](/content/frontmatter.md), [Memos](/content/memos-source.md),
  [Media](/content/media.md)
* Frontend: [Feed](/frontend/feed.md),
  [Live update](/frontend/live-update.md),
  [URLs and SEO](/frontend/urls-seo.md)
* Features: [Search](/features/search.md), [RSS](/features/rss.md)
* Community: [Comments](/community/comments.md),
  [Webmentions](/community/webmentions.md)
* [Sanitizing](/security/sanitization.md), [Pipeline](/ops/pipeline.md)
* [Open points](/open-points.md)
