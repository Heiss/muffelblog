---
type: Process
title: Build pipeline
description: Scheduler, change detection, atomic swap and failure rules of the builder.
tags: [build, scheduler, operations]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Flow

1. **[E]** Every 3 minutes the scheduler checks Nextcloud, Memos, webmention.io
   and Remark42.
2. **[V]** It compares hashes or change markers with the last run. Without a
   change there is no build.
3. **[V]** On a change it waits briefly (debounce), so half-synchronized files
   are not built, and then builds the complete site.
4. **[V]** After Astro, Pagefind runs over the result, `build.json` is written
   last, and the symlink `current` is switched atomically.
5. **[V]** After delivery the builder sends webmentions (see
   [Webmentions](/community/webmentions.md)) and posts new mentions to
   Remark42.
6. **[V]** Old releases are deleted after a grace period, the last N stay.

# Failure rules

* **[V]** If a fetch fails (Nextcloud, Memos, webmention.io or Remark42), the
  build stops and the last good version stays online. An empty or incomplete
  fetch never counts as "everything deleted".
* **[V]** A single broken file (invalid YAML, wikilinks, missing image) skips
  only that file and is logged (see [Frontmatter](/content/frontmatter.md)).
* **[V]** A failed build is reported. The channel is open (O18).

# Rate and load

* Number of memos: about 2 per month, build time hardly matters.
* **[V]** For comments, not all pages are queried individually on every run,
  only the changed ones (for example through the latest comments since the last
  run). **[U]** `GET /api/v1/last/{limit}?site&since` exists according to the
  API documentation. Its suitability has not been checked.

# Open

O18 (alerting, backup), O10 (image build), O8 (versions).
