---
type: Reference
title: URLs and SEO
description: URL scheme, canonical rules, sitemap and SEO principles.
tags: [url, seo, sitemap, canonical]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# URL scheme

| Page | URL | Status |
|---|---|---|
| Feed (home) | `/` | **[E]** |
| Post | `/p/<slug>/` | **[E]** |
| Memo | `/m/<uid>/` | **[E]** |
| Glossary entry | `/g/<slug>/` | **[V]** |
| Technical blocks (mixed) | `/page/N/` | **[E]** |
| Technical blocks (memos, posts) | `/memos/page/N/`, `/posts/page/N/` | **[E]** |
| Tag overview | `/tag/` | **[E]** |
| Tag | `/tag/<tag>/`, blocks `/tag/<tag>/page/N/` | **[E]** |
| Glossary (A to Z) | `/glossary/` | **[E]** |
| Technical blocks (terms) | `/terms/`, `/terms/page/N/` | **[E]** |
| Search | `/search/` | **[V]** |
| RSS | `/feed.xml` | **[V]** |
| Build signal | `/build.json` | **[E]** |

The names for tag, search and the RSS path are proposals for the short and
concise form the user asked for. The user confirmed `/p/<slug>/` and
`/m/<uid>/`. All URLs are English and independent of the UI language (see
[Languages](/ops/language.md)).

# SEO rules

* **[E]** Every post and every memo has a page of its own for linking and for
  search engines.
* **[V]** The slug carries keywords and contains no date.
* **[V]** One canonical URL per page, a consistent trailing slash.
* **[E]** `lang="de"`, absolute canonical URLs and a sitemap with the home
  page, posts, memos and tags, but without `/page/N/`. Both exist only if
  `SITE_URL` is set (domain open, O9).
* **[V]** Memos have no title. Title and description are derived from the text
  (see [Memos](/content/memos-source.md)).

# Domain

**[E]** The domain is set later. Webmention targets, the Remark42 mapping and
RSS identifiers depend on the URL and should be fixed before the first comment
and the first mention. For Remark42 the API documentation describes
`POST /api/v1/admin/remap` for moving comments. Webmentions at the old domain
are lost.

# Open

Open Graph and social cards (O17), 404 page, `robots.txt`, favicon (O16),
imprint and privacy policy as pages of their own (O15).
