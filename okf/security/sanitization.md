---
type: Policy
title: Sanitizing foreign content
description: Sanitizing, SSRF protection and handling of secrets for all foreign or semi-trusted input.
tags: [security, sanitizing, ssrf, secrets]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Decision

**[E]** All foreign content is sanitized.

# Inputs and rules

| Input | Trust | Rule |
|---|---|---|
| Article Markdown (Nextcloud) | own, but a share link leak is possible | the same sanitizing as everything else |
| Memos Markdown | own | like articles |
| Webmentions | foreign | text only, no HTML |
| Comments (Remark42) | foreign | HTML only through an allowlist, even if Remark42 sanitizes itself |
| Avatars and memo images | foreign or own | type and size check, remove EXIF, reject SVG |

**[E]** Markdown is rendered through a fixed pipeline
(`packages/core/src/render.ts`): Markdown (with GFM), raw HTML parsed, then an
allowlist (`rehype-sanitize`), then the check of images, links and embeds. Raw
HTML stays only within the allowlist: scripts, event attributes, `javascript:`
and `data:` links, forms, styles, SVG, objects and comments are dropped
together with their content. After that `lowlight` colors code blocks with a
known language through classes (`hljs-*`), not through styles; the classes come
only from the coloring. External links get `rel="noopener noreferrer"`,
headings move down one level.

# SSRF protection

* **[V]** When fetching foreign URLs (avatars, mention sources, targets when
  sending), private and internal IP ranges, loopback and link-local are
  rejected, also after resolving redirects.
* **[V]** Time, size and redirect limits for every fetch.

# Secrets

* **[V]** Secrets are not in the repo (see [Docker](/architecture/docker.md)).
* **[V]** `ADMIN_PASSWD` only in the `builder` and in `remark42`.
* **[V]** A Nextcloud share link without a password is forbidden, because it
  makes the whole folder public including drafts.

# Content Security Policy

**[V]** `script-src 'self'`. `img-src` with `'self'` and the allowed image
hosts, `frame-src` with the allowed embed hosts (see [Media](/content/media.md)).
There are no further foreign sources.
