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
| `MUFFEL_LANG` | `en` | `en`, `de` | Language of the user interface, one per build (see [Language](/ops/language.md)). Not a number: it is read next to `SETTING_SPECS` in `config.ts` (`LANGUAGES`, `DEFAULT_LANG`), an unknown value stops the build |
| `MUFFEL_FEED_PAGE_SIZE` | 20 | 1 to 200 | Entries per block of the feed |
| `MUFFEL_FEED_EXCERPT_CHARS` | 200 | 20 to 2000 | Length of the article excerpt in the feed |
| `MUFFEL_MEMOS_DESCRIPTION_CHARS` | 160 | 20 to 500 | Length of the description of a memo page |
| `MUFFEL_MEMOS_TIMEOUT_MS` | 30000 | 1000 to 300000 | Time limit per request to Memos |
| `MUFFEL_MEMOS_MAX_FILE_MB` | 25 | 1 to 500 | Maximum size per mirrored memo file |
| `MUFFEL_RSS_ITEMS` | 50 | 1 to 500 | Number of entries in the RSS feed |
| `MUFFEL_RELEASES_KEPT` | 3 | 1 to 50 | Number of releases kept on disk |
| `MUFFEL_CHECK_INTERVAL_SECONDS` | 180 | 10 to 3600 | Seconds between two checks of Nextcloud and Memos |
| `MUFFEL_DEBOUNCE_CHECKS` | 1 | 0 to 10 | Equal checks in a row after a change before it is built |
| `MUFFEL_WEBMENTIONS_SEND` | `0` | `0`, `1` | Send webmentions (see [Webmentions](/community/webmentions.md)); needs `SITE_URL`. Off by default ([Defaults stay inside](/ops/defaults.md)) |
| `MUFFEL_WEBMENTIONS_BLOCK` | empty | host names | Hosts that are never asked, subdomains included |
| `MUFFEL_WEBMENTIONS_ALLOW_PRIVATE` | `0` | `0`, `1` | Lifts the address check of the sender; tests and the local receiver only |
| `MUFFEL_WEBMENTIONS_TIMEOUT_MS` | 10000 | 1000 to 60000 | Time limit per request to a foreign server |
| `MUFFEL_WEBMENTIONS_MAX_KB` | 1024 | 16 to 10240 | Largest part of a foreign response that is read |
| `MUFFEL_WEBMENTIONS_MAX_TARGETS` | 10 | 1 to 100 | Links of one entry that are reported |
| `MUFFEL_WEBMENTIONS_DELAY_MS` | 1000 | 0 to 60000 | Pause between two requests to foreign servers |
| `MUFFEL_WEBMENTIONS_ATTEMPTS` | 3 | 1 to 10 | Tries per source and target over later builds |
| `MUFFEL_WEBMENTIONS_NO_ENDPOINT_DAYS` | 30 | 1 to 365 | Days a host without an endpoint is not asked again |
| `MUFFEL_WEBMENTIONS_ENDPOINT_DAYS` | 7 | 1 to 365 | Days a found endpoint is reused |

Further variables: `MATOMO_URL`, `MATOMO_SITE_ID` (optional Matomo of the operator, without cookies; both or none, an invalid address stops the build; O19). Setup of Compose (see [Docker operation](/architecture/docker.md)):
`MUFFEL_BIND`, `MUFFEL_PORT`, `MUFFEL_COMMENTS_PORT`, `MUFFEL_TRUSTED_PROXIES`
(addresses of the reverse proxy whose `X-Forwarded-For` is believed, default
`private_ranges`), `MUFFEL_VERSION`, `MUFFEL_RELEASES_DIR`, `REMARK_PORT`,
`MUFFEL_MAIL_PORT` (demo), `COMPOSE_FILE`. Required in `compose.yaml`:
`SITE_URL`, `COMMENTS_URL`, `MAIL_FROM`, `REMARK_ADMIN_EMAIL`, `SMTP_HOST`,
`SMTP_PORT`, `REMARK_SECRET`, `REMARK_ADMIN_PASSWD`. `MUFFEL_ALERT_WEBHOOK` (optional URL that receives a POST when a build fails and when it works again), `MUFFEL_ALERT_FORMAT` (`text` default, ntfy style; `json` for Slack style), `NEXTCLOUD_URL`, `NEXTCLOUD_SHARE_TOKEN`,
`NEXTCLOUD_SHARE_PASSWORD` or `NEXTCLOUD_SHARE_PASSWORD_FILE` (builder; see
[Nextcloud source](/content/nextcloud-source.md)), `REMARK_INTERNAL_URL` (how the builder reaches Remark42, for the static copy of the comments; needs `SITE_URL`), `COMMENTS_URL` (origin of Remark42 as the browser reaches it; no
comments without it), `COMMENTS_SITE_ID` (default `muffelblog`), `CONTENT_DIR`, `MEMOS_URL` (required), `SITE_URL` (optional,
sitemap and canonical), `MUFFEL_FIXTURES` (development and tests only): `1` is the edge-case set of the tests,
`demo` is the realistic demo content (see [Test strategy](/ops/testing.md)). Any other value counts as unset. The
test build in the repo sets `MUFFEL_FEED_PAGE_SIZE=4`.

# Open

* **[U]** Image widths and the size limit for images (`media.ts`), the polling
  interval and time limits of later packages are not converted. New numeric
  values should get a variable with their work package.
* **[E]** The Docker services pass the variables through: `compose.yaml` lists
  them for the builder, `compose.test.ts` and the Compose job in CI (smoke,
  comment, moderation and webmention flows) check the wiring (settled with W12).
