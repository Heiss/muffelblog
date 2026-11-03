---
type: Feature
title: RSS
description: Combined RSS feed for posts and memos.
tags: [rss, feed]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Decisions

* **[E]** One combined feed for posts and memos.

# Implementation

* **[V]** `/feed.xml`, created at build time with the Astro RSS package.
* **[V]** Number of entries limited (proposal: 50). Full text or excerpt is
  open (O20).
* **[V]** The GUID is the stable identifier `post:<slug>` or `memo:<uid>` with
  `isPermaLink="false"` and does not depend on the date or on the domain. So
  GUIDs stay the same when the domain or a date changes.
* **[V]** Memos have no title of their own, the feed title is derived from the
  text (see [Memos](/content/memos-source.md)).
* **[V]** Comments and mentions do not appear in the feed.

# Risk

Without a domain (see [URLs and SEO](/frontend/urls-seo.md)) no absolute links
can be created. Feeds need absolute URLs.
