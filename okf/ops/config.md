---
type: Policy
title: Configuration through environment variables
description: Which numeric values can be set through environment variables, their defaults, ranges and the failure behavior.
tags: [configuration, environment-variables, operations]
status: draft
generated: { by: claude-code/web, at: 2026-11-03T05:30:00Z }
---

# Decisions

* **[E]** Numeric values that the operator should be able to change are
  environment variables following the scheme `MUFFEL_<AREA>_<NAME>`. The
  existing names `CONTENT_DIR`, `MEMOS_URL` and `SITE_URL` stay unchanged.
* **[E]** An invalid value stops the build, the last good version stays online.
  There is no warning with a fallback to the default value.
* **[E]** Scope: feed and memos. Media (image widths, size limit for images)
  stay in the code for now.
* **[E]** Allowlists for hosts and file types and the check of the file
  signature are not configurable. A misconfiguration must not open a security
  hole.
* **[E]** The UI language is an environment variable too, `MUFFEL_LANG`
  (`de` or `en`), see [Languages](/ops/language.md) (W23).

# Rules

* All values apply at build time and are written into the pages. A change takes
  effect only after the next build.
* Only unsigned integers are allowed, whitespace around them is removed. An
  empty variable counts as unset (Compose delivers it like that).
* All errors are reported at once, with variable name and range.
* The source of truth is `packages/core/src/config.ts` (`SETTING_SPECS`). The
  table below must match it, a test checks defaults and bounds.

# Variables

| Variable | Default | Range | Effect |
|---|---|---|---|
| `MUFFEL_FEED_PAGE_SIZE` | 20 | 1 to 200 | Entries per block of the feed |
| `MUFFEL_FEED_EXCERPT_CHARS` | 200 | 20 to 2000 | Length of the article excerpt in the feed |
| `MUFFEL_MEMOS_DESCRIPTION_CHARS` | 160 | 20 to 500 | Length of the description of a memo page |
| `MUFFEL_MEMOS_TIMEOUT_MS` | 30000 | 1000 to 300000 | Time limit per request to Memos |
| `MUFFEL_MEMOS_MAX_FILE_MB` | 25 | 1 to 500 | Maximum size per mirrored memo file |
| `MUFFEL_RSS_ITEMS` | 50 | 1 to 500 | Number of entries in the RSS feed |
| `MUFFEL_RELEASES_KEPT` | 3 | 1 to 50 | Number of releases kept on disk |
| `MUFFEL_CHECK_INTERVAL_SECONDS` | 180 | 10 to 3600 | Seconds between two checks of Nextcloud and Memos |
| `MUFFEL_DEBOUNCE_CHECKS` | 1 | 0 to 10 | Equal checks in a row after a change before it is built |

Further variables: `MUFFEL_ALERT_WEBHOOK` (optional URL that receives a POST when a build fails and when it works again), `MUFFEL_ALERT_FORMAT` (`text` default, ntfy style; `json` for Slack style), `NEXTCLOUD_URL`, `NEXTCLOUD_SHARE_TOKEN`,
`NEXTCLOUD_SHARE_PASSWORD` or `NEXTCLOUD_SHARE_PASSWORD_FILE` (builder; see
[Nextcloud source](/content/nextcloud-source.md)), `COMMENTS_URL` (origin of Remark42 as the browser reaches it; no
comments without it), `COMMENTS_SITE_ID` (default `muffelblog`), `CONTENT_DIR`, `MEMOS_URL` (required), `SITE_URL` (optional,
sitemap and canonical), `MUFFEL_FIXTURES` (development and tests only): `1` is the edge-case set of the tests,
`demo` is the realistic demo content (see [Test strategy](/ops/testing.md)). Any other value counts as unset. The
test build in the repo sets `MUFFEL_FEED_PAGE_SIZE=4`.

# Open

* **[U]** Image widths and the size limit for images (`media.ts`), the polling
  interval and time limits of later packages are not converted. New numeric
  values should get a variable with their work package.
* **[U]** Whether the Docker services pass the variables through is settled only
  with W11/W12.
