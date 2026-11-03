---
type: Feature
title: Search
description: Full-text search with Pagefind over posts and memos, with filters.
tags: [search, pagefind]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Decisions

* **[E]** Pagefind.
* **[E]** Posts and memos are in the index because both have static pages.

# Implementation

* **[V]** Pagefind runs as a CLI over the output directory after the Astro
  build. The result is part of the release, so it is swapped atomically with
  it.
* **[V]** Filters: type (post or memo) and tag through `data-pagefind-filter`.
* **[V]** The technical blocks (`/page/N/`) are excluded with
  `data-pagefind-ignore`, otherwise entries would appear twice.
* **[V]** Comments and mentions are not in the index.
* **[U]** Pagefind offers a German user interface. This has not been checked.

# Note

Pagefind runs in the browser with WebAssembly and loads its files from the own
domain. There are no foreign requests.
