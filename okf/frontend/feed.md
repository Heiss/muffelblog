---
type: Feature
title: Feed
description: Combined, chronological feed with a filter and endless scroll.
tags: [feed, endless-scroll, frontend]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Decisions

* **[E]** One home page (`/`) shows posts and memos together, purely
  chronological, newest first.
* **[E]** Endless scroll instead of visible pagination.
* **[E]** The feed is a single stream (unified mode) with a filter (All / Long
  / Short, later also Terms). The filter is kept in the browser storage.
* **[E]** The split view (two columns with a draggable bar) is dropped. The user
  considers it unnecessary complexity. This replaces the decision from the
  beginning.
* **[E]** Labels of the filter (German UI): **Kurz** (short) for memos, **Lang**
  (long) for blog posts and **Begriffe** (terms) for glossary entries. The
  label applies in the display, headings and page titles. The addresses of the
  series stay `/memos/` and `/posts/` (and `/terms/` for terms), the single
  pages `/m/<uid>/` and `/p/<slug>/`.
* **[E]** Memos appear in full with their images.

# Data source for endless scroll

* **[E]** Technical HTML blocks `/page/N/` with `noindex, follow`. The
  JavaScript loads them while scrolling and appends the entries. Visitors never
  see pagination. Without JavaScript a normal "older entries" link continues
  (implemented in W05).
* **[E]** The blocks are not in Pagefind (`data-pagefind-ignore`) and not in
  the sitemap. Page 1 has no route of its own (`/page/1/` gives 404), it lives
  at the base (`/`, `/memos/`, `/posts/`, `/tag/<tag>/`).
* **[E]** Tag lists use the same procedure.
* **[E]** The filter uses one block series each: mixed (`/page/N/`), only memos
  (`/memos/page/N/`), only posts (`/posts/page/N/`). **[E]** Block size 20
  entries. Implemented in W05.

# Behavior in the browser

* **[E]** An `IntersectionObserver` at the end of the list loads the next
  block. Duplicate entries are discarded by their id (implemented in W06a).
* **[E]** Scroll position and loaded blocks are restored when going back from
  an article (implemented in W06a, a note in `sessionStorage`).
* **[V]** The footer is hard to reach with endless scroll. Important links
  (imprint, privacy policy, RSS) therefore belong in the fixed header or
  sidebar.
* **[E]** The browser storage (`localStorage`) is optional. If it is missing,
  the default filter "All" applies.

# Accessibility

**[V]** New blocks are not announced one by one through `aria-live`. Errors
while loading more are shown in an area with `role="status"`, together with a
normal link.
