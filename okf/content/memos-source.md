---
type: Data Source
title: Memos source
description: Fetching public memos at build time and creating pages of their own for memos.
tags: [memos, build, microblog]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
sources:
  - id: memos-proto
    resource: https://github.com/usememos/memos/tree/main/proto/api
    title: Memos API (protobuf definitions)
  - id: memos-changelog
    resource: https://raw.githubusercontent.com/usememos/memos/main/proto/api/CHANGELOG.md
    title: Memos API changelog
  - id: memos-access
    resource: https://raw.githubusercontent.com/usememos/memos/main/server/api/memo_service.go
    title: Memos access check when listing
---

# Decisions

* **[E]** All memos are publicly readable (`PUBLIC`). Only public memos are
  used.
* **[E]** Memos are fetched at build time. Every memo has a page of its own
  `/m/<uid>/`, see [URLs and SEO](/frontend/urls-seo.md).
* **[E]** Links point only to the own pages, never to the Memos instance.
* **[E]** Images are mirrored (see [Media](/content/media.md)).
* **[E]** Memos appear in full with images in the feed.
* **[E]** Amount: about 2 memos per month.
* **[E]** The newest Memos version runs. Comments of its own on the Memos
  instance are not used.
* **[E]** Title (O14): always date and time, for example "Memo vom 2. Nov. 2026,
  14:32" (Europe/Berlin). The title text is UI text and follows the UI language
  from W23 on.
* **[E]** Other attachments (O6): PDF, audio and video are mirrored with a size
  limit, everything else is not (see [Media](/content/media.md)).
* **[E]** Alt text of images: file name without extension.
* **[E]** Nested tags (`#a/b`) stay one tag `a/b`, the URL form is `a-b`. Proven
  by the contract test: Memos returns the tags `a` and `a/b` for `#a/b`. The
  parent tag `a` is therefore discarded if the same entry has a tag `a/...`. If
  one wrote `#a` and `#a/b` explicitly, `a` is lost.

# Supported versions (decided by the owner 2026-11-05, O8)

* **[E]** Pinned versions, never "latest". `supported-versions.json` names a
  current and a previous version of Memos and Nextcloud; CI runs the contract
  tests against both in parallel; Renovate raises the current one, the previous
  one follows by hand in the same pull request. Docs: reference/versions.

# API (proven from the source code, version 26.11.0)

* The REST paths have been called `/api/...` since 26.10.0 (before that
  `/api/v1/...`).[^memos-proto] The changelog warns about breaks between
  versions.[^memos-changelog]
* List: `GET /api/memos` with `page_size`, `page_token`, `filter` (CEL, for
  example `visibility == "PUBLIC"`) and `order_by` (`create_time desc`).
  Response: `memos` and `nextPageToken`. Fields in
  lowerCamelCase.[^memos-proto]
* Attachment file: `GET /file/attachments/<uid>/<file name>`.[^memos-proto]
* A memo has `name` (`memos/<uid>`), `content`, `visibility`, `state`, `tags`
  (extracted from the text), `attachments` and `createTime`. There is **no**
  `displayTime`, so `createTime` is the date.[^memos-proto]
* Without login the instance returns memos only if its access mode (`ACCESS`)
  is `PUBLIC`. Then an anonymous caller sees only `PUBLIC` memos, and the file
  route serves their attachments. With `PRIVATE` the instance answers "not
  logged in".[^memos-access]
* Memos has webhooks per user. The builder does not need them, it checks every
  3 minutes by polling.[^memos-proto]

# Implementation

* `packages/core/src/memos.ts`: `createHttpMemosSource` (fetching without
  login, redirects are never followed, time limit, page token protection) and
  `buildMemoEntries` (page data, mirroring attachments).
* **[E]** A fetch error (network, server error, broken response, login
  required) throws and stops the build, the last good version stays online.
  There is never a partial result. A single unusable entry or a missing
  attachment (HTTP 404) is skipped and reported.
* **[E]** The build requires `CONTENT_DIR` and `MEMOS_URL`. If one is missing,
  it stops. Sample data exists only with `MUFFEL_FIXTURES=1`, so a mistake in
  the configuration never publishes sample content.
* Memos that are not `PUBLIC`, are archived or have a `parent` (comments) are
  discarded in addition to the filter of the API.
* The text goes through the same sanitizing as articles, but in the strict
  mode: remote images and embeds are always removed.
* Description: plain text of the memo, at most 160 characters (configurable,
  see [Configuration](/ops/config.md)), cut at a word boundary. Without text it
  stays empty.
* Tags come from the field `tags` of the API and are lowercased like all tags.
  The contract test runs against a real instance 26.11.0 (image
  `neosmemo/memos:26.11.0`, login, access mode PUBLIC, memos and attachment
  created through REST) and confirms paths, field names, anonymous fetching
  and the file route (see [Test strategy](/ops/testing.md)).
* The order of the pages is newest first.

# Open points

* **[U]** Stability of the `uid` over time is not proven.
* **[U]** The behavior of attachments that are stored externally
  (`externalLink`) on the file route is not proven. The builder does not load
  them.
* **[E]** HEIC photos (iPhone) are converted to JPEG with `heif-convert`
  (builder image), then processed like any image (O36). Without the program
  they are skipped with a note.

# Deleting and downgrading

A memo that is no longer public or is deleted is missing in the next build.
Visitors with open tabs, browser caches and search engines keep copies. If
fetching aborts, the memo must not count as deleted (see
[Pipeline](/ops/pipeline.md)).

[^memos-proto]: Memos API (protobuf definitions)
[^memos-changelog]: Memos API changelog
[^memos-access]: Memos access check when listing
