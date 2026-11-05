---
type: Process
title: Build pipeline
description: Scheduler, change detection, atomic swap and failure rules of the builder.
tags: [build, scheduler, operations]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Implemented (W12, 2026-11-04)

* **[E]** The builder runs permanently (`restart: unless-stopped`). Every
  `MUFFEL_CHECK_INTERVAL_SECONDS` (180) it reads a **marker** of each source
  without downloading: Nextcloud = fingerprint of the file list (path, size,
  `getlastmodified`), Memos = fingerprint of the public memos (text, date, tags,
  attachment names and sizes). A source that cannot be read completely, or an
  empty Nextcloud list, is an error and never a change.
* **[E]** Debounce (decided 2026-11-04): a changed marker is built only after it
  stayed the same for `MUFFEL_DEBOUNCE_CHECKS` further checks (default 1, so new
  content appears 3 to 6 minutes after the last change; 0 = at once). With no
  release online yet, the first build happens at once.
* **[E]** The built marker is remembered in `state/scheduler.json`: a restart
  does not rebuild without a change. Folders in `releases/` without
  `build.json` (a build that was killed) are removed at the start.
* **[E]** Reporting (O18, decided 2026-11-04): log, `state/status.json`
  (`ok` or `failing`, last success, last error with the start of the failure)
  and an optional webhook `MUFFEL_ALERT_WEBHOOK` (POST; `text` for ntfy style,
  `json` for Slack style). One message when a failure starts and one when it is
  over, not one per check. The webhook never stops the builder. The last good
  release stays online in every failure case.
* **[E]** Compose: `web` waits until the builder is healthy, that is until the
  first release is online.
* **[U]** Not covered: a change of the content of an attachment that keeps its
  name and size (Memos), and Remark42 and webmention sources (W13 copy, W14).

# Flow (original proposal)

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
  run). **[E]** In the end the scheduler fingerprints `GET /api/v1/last/1000?site`
  (one request, see [Comments](/community/comments.md)); the `since` variant was
  not needed.

# Open

O18 (alerting, backup), O10 (image build), O8 (versions).
