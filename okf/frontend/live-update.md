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

# Content of build.json

**[V]**

```json
{
  "build": "<build id>",
  "entries": [
    { "id": "post:<slug>", "date": "<ISO 8601>" },
    { "id": "memo:<uid>",  "date": "<ISO 8601>" }
  ]
}
```

`entries` holds the newest N entries (proposal: 20), so the client can compute
the number of new entries without reloading the page. If more than N are new,
the banner shows "N+ new entries". The build id changes on every build, even if
only comments or mentions changed. The client therefore compares the entry
ids, not only the build id.

# Polling

* **[V]** `cache: 'no-cache'` with ETag: the server mostly answers with 304.
* **[V]** Interval 60 seconds while the tab is visible, the scheduler runs
  every 3 minutes (see [Pipeline](/ops/pipeline.md)). The user had named "3
  minutes" for the intervals. The 60 seconds for the client are a proposal.
* **[V]** On a click on the banner, the new entries are fetched from the first
  block of the feed (`/`) and inserted at the top, then the page scrolls up.
* **[V]** If the build id changes during polling but there are no new entries,
  the banner stays off.

# Risks

* `build.json` must appear as the last file of a build (see
  [Docker](/architecture/docker.md)), otherwise clients report a new state
  before the pages are complete.
* Old tabs reference hashed assets that may be missing after a build. Earlier
  releases are therefore kept for a while.
* Load: 100 simultaneous visitors at a 60 s interval are about 1.7 requests per
  second, almost all of them with 304.
