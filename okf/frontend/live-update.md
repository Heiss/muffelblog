---
type: Feature
title: Live update through build.json
description: Detecting new builds by polling a small file and the banner "N new entries".
tags: [build-json, polling, frontend]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Decisions

* **[E]** Polling a small file `build.json`, no SSE, no WebSocket. There are no
  permanent connections for visitors.
* **[E]** The client shows a banner "N new entries" when there are new
  entries. A click scrolls all the way up and shows them.
* **[E]** The banner counts only entries that are newer than the newest one
  already loaded. Back-dated entries appear only on the next load.
* **[V]** The client polls only while the tab is visible.

# Implemented (W07, decided by the owner on 2026-11-05)

The owner chose the counter "N new entries" as in this roadmap. The details were
settled while building it.

* **[E]** Two small files, both revalidated at every request (`Cache-Control:
  no-cache`): `build.json` (`{"id", "builtAt"}`, written by the builder as the
  last file) says that a new build is online; `entries.json` (written by the site
  build) lists the newest 20 entries: `id`, `kind`, `date` and the tag addresses,
  newest first, no titles and no texts. The proposal to put the list into
  `build.json` was not followed, so the builder stays independent of the site
  content.
* **[E]** The client reads `build.json` once at the start (the baseline) and then
  every 60 seconds, only while the tab is visible and again as soon as it becomes
  visible. Only when the build id changed it reads `entries.json` once.
* **[E]** New means: newer than the newest entry in the list, not in the list
  yet, of the kind of the series (post, memo, term) and, on a tag page, with that
  tag. A build without such entries (a comment changed) shows nothing. If the
  whole window of 20 is new, the banner says "20+".
* **[E]** The banner exists only on the first block of a series and of a tag page;
  later blocks and articles do not poll.
* **[E]** A click hides the banner, fetches the first block of the page, replaces
  the list with it and scrolls to the top.
* **[E]** If a build changes between the page being made and the first look at
  `build.json` (a few seconds), the entries of that build count at the next
  build. Accepted.
* **[E]** The banner is a sticky button in the style of the filter pills, in the
  colours of the theme; its text is in the UI language. axe finds no violations
  with the banner shown.
* **[U]** Not tested: very long open tabs after several builds (the assets of an
  earlier release stay for `MUFFEL_RELEASES_KEPT` builds), and the feel of the
  banner on a phone.

# Risks

* `build.json` must appear as the last file of a build (see
  [Docker](/architecture/docker.md)), otherwise clients report a new state
  before the pages are complete.
* Old tabs reference hashed assets that may be missing after a build. Earlier
  releases are therefore kept for a while.
* Load: 100 simultaneous visitors at a 60 s interval are about 1.7 requests per
  second, almost all of them with 304.
