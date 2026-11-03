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
* **[E]** Posts, memos and terms are in the index because all have static pages.
* **[E]** (2026-11-03, O16) Own UI on `/search/` built on the Pagefind JS API, not
  the Default or Modular UI: the Modular UI has hard-coded English texts and no
  translation option. All texts come from the message catalog (ready for W23).
  Filters: kind (Lang, Kurz, Begriffe) and tag.

# Implementation

* **[V]** Pagefind runs as a CLI over the output directory after the Astro
  build. The result is part of the release, so it is swapped atomically with
  it.
* **[V]** Filters: type (post or memo) and tag through `data-pagefind-filter`.
* **[V]** The technical blocks (`/page/N/`) are excluded with
  `data-pagefind-ignore`, otherwise entries would appear twice.
* **[V]** Comments and mentions are not in the index.
* **[E]** Checked: the Modular UI is English only (see above). Pagefind itself
  indexes with the page language (`de`).
* **[E]** Only pages with `data-pagefind-body` are indexed (posts, memos,
  terms); feed blocks, tag and search pages carry none. Kind is a
  `<meta data-pagefind-filter="kind[content]">`, tags are `data-pagefind-filter="tag"`.
* **[E]** Pagefind runs as part of `pnpm build` (`astro build && pagefind --site dist`).
* **[V]** The CSP needs `script-src 'self' 'wasm-unsafe-eval'` because Pagefind
  uses WebAssembly.

# Note

Pagefind runs in the browser with WebAssembly and loads its files from the own
domain. There are no foreign requests.
