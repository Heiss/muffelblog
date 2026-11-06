---
type: Schema
title: Frontmatter schema for articles
description: Required fields, fallbacks and processing rules of the YAML frontmatter of the Markdown articles.
tags: [frontmatter, obsidian, tags, slug]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Fields

| Field | Type | Required | Rule |
|---|---|---|---|
| `publish` | boolean | **[E]** yes | Only the boolean `true` counts. `"true"` or `yes` do not. If it is missing, the file is ignored. |
| `date` | date/time | **[E]** yes, with fallback | Missing or invalid: modification date of the file. |
| `title` | text | **[V]** yes | If it is missing, it is derived from the file name. |
| `slug` | text | **[V]** no | If it is missing, it is derived from the file name. |
| `description` | text | **[V]** no | Meta description, feed excerpt. |
| `tags` | list | **[V]** no | Obsidian properties, lists of strings. That tags exist is **[E]**. |
| `type` | text | **[E]** no | `glossary` marks a glossary entry (see [Glossary](/features/glossary.md)); planned in W19. Without it the file is an article. |
| `comments` | boolean | **[E]** no | Default enabled. `false` keeps existing static comments visible but omits the posting widget on posts and terms. Only YAML booleans are accepted; other values warn and are ignored. Remark42 server closure is independent. |

Unknown fields (`aliases`, `cssclasses` and others) are ignored.

# Date

* **[E]** `date` is a required field. If it is missing, the modification date
  of the file counts as a fallback.
* **[U]** Over WebDAV only `getlastmodified` is available, no creation date. The
  modification date is set anew on every edit. Posts without `date` therefore
  jump in the chronology and appear as new again in RSS if the GUID depends on
  the date.
* **[V]** The RSS GUID therefore does not depend on the date (see
  [RSS](/features/rss.md)).
* **[E]** Format and time zone (O2): a plain date and a date with a time are
  allowed. A plain date (`2026-01-05`) counts as 12:00 in Europe/Berlin. A time
  without a zone (`2026-07-01 09:30` or `2026-07-01T09:30`) counts as Berlin
  local time. With `Z` or an offset (`+02:00`) exactly that instant counts.
  Everything else is invalid and falls back to the modification date.
* Implementation: the conversion of Berlin local time uses `Intl` in
  `packages/core/src/date.ts`, checked on the days of the daylight saving time
  changes. Node 26 knows `Temporal`, the TypeScript types for it have not been
  checked.

# Slug

* **[E]** URL scheme `/p/<slug>/`, see [URLs and SEO](/frontend/urls-seo.md).
* **[V]** Slugs are transliterated: ä→ae, ö→oe, ü→ue, ß→ss, then lowercase
  letters, digits and `-`.
* **[E]** Duplicate slugs (O26): a suffix is appended automatically (`-2`,
  `-3`). The article with the older `date` keeps the slug, on a tie the path
  decides. This is deterministic but not stable: if an article with an older
  date and the same slug is added later, the URLs swap. A `slug:` in the
  frontmatter avoids that. Every assignment of a suffix is logged as a warning.
* **[V]** If the slug is derived from the file name, renaming changes the URL.
  A `slug:` in the frontmatter fixes it.
* **[V]** Decomposed umlauts (a + ¨, as macOS file names deliver them) are
  composed (NFC) before transliterating.

# Tags

* **[E]** Tags exist, also for search.
* **[V]** A shared tag namespace for posts and memos.
* **[E]** Normalization (O13): tags are lowercased throughout, also in the
  display (`iOS` becomes `ios`). A leading `#` is dropped, whitespace is
  collapsed, duplicate tags are dropped. The URL form is transliterated (`über
  größe` becomes `/tag/ueber-groesse/`). A single text instead of a list counts
  as one tag. Non-text entries are ignored with a warning.
* Still open: whether inline `#tags` in the article text count (later).

# Error handling

* **[V]** Invalid YAML in a file: only that file is skipped and logged, never
  the whole build.
* **[V]** `publish: true` with an invalid `date`: fallback to the modification
  date and a warning in the log.
* **[V]** Invalid YAML is reported only if the file clearly contains
  `publish: true`. Otherwise it stays silently ignored, so private notes in the
  folder do not produce warnings.
* **[V]** Files with wikilinks (`[[...]]`, also `![[...]]`) are skipped and
  reported. Code blocks and inline code do not count.
* **[E]** Withdrawn articles (O21) (`publish` removed or file deleted)
  disappear with the next build and give 404. There is no stored state for
  this.
* **[U]** The patterns for conflict copies (`(conflicted copy ...)`,
  `(Konfliktkopie ...)`, `.sync-conflict-`) are not checked against real
  Nextcloud file names. The contract test in W02 takes that over.
