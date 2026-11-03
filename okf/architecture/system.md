---
type: Architecture
title: System architecture
description: Components, data flows and basic rules of the static blog.
tags: [architecture, build, astro]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Components

| Component | Role | Runs |
|---|---|---|
| Nextcloud (external) | Source of the articles through public-share WebDAV | external |
| Memos (external) | Source of the microposts, public API | external |
| webmention.io (external) | Receiving incoming webmentions | external |
| Builder | Sync, Astro build, Pagefind, scheduler, mention sync and sending | Docker |
| Web | Serving the static files, reverse proxy | Docker |
| Remark42 | Comments, email login | Docker |
| Migadu (external) | SMTP for the login mails of Remark42 | external |

# Data flow

1. **[E]** Every 3 minutes the builder checks Nextcloud, Memos, webmention.io
   and Remark42 for changes.
2. **[E]** If there are changes, Astro rebuilds the complete site. Astro does
   not build incrementally.
3. **[E]** Pagefind indexes the result. The result atomically replaces the
   version served so far (see [Pipeline](/ops/pipeline.md)).
4. **[E]** The browser polls `build.json` (see
   [Live update](/frontend/live-update.md)).
5. **[E]** Comments are loaded and sent in the browser through the Remark42
   widget. In addition there is a static copy in the HTML (SEO, without JS).

# Basic rules

* **[V]** Static-first: every page works without foreign services, without
  Nextcloud and without Memos once it is served. Only commenting needs
  Remark42. This is my reading of "standalone", unconfirmed (O27).
* **[E]** At run time the browser loads nothing from third-party services. The
  Remark42 widget is loaded from the own server. Articles are an exception:
  they may contain remote images and embeds from allowlists, embeds only after
  a click (see [Media](/content/media.md)).
* **[V]** If a fetch fails during the build, the build is aborted and the last
  good version stays online. An empty fetch must never count as "everything
  deleted".
* **[V]** Endpoints that fetch foreign data (mentions, avatars, memo images)
  are protected by [sanitizing](/security/sanitization.md).

# Open

See [Open points](/open-points.md), in particular O1 (block series), O9
(reverse proxy) and O10 (image build).
