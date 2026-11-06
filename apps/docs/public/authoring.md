# Muffelblog authoring instructions for AI

Use this document to create Markdown blog posts and glossary entries for the
owner's Nextcloud content folder. These are content files, not Astro source
files. Read the whole guide before writing. Follow the owner's instructions
and preserve decisions already supplied. Never promise that prose is factually
correct merely because the Markdown is valid.

## Gather the brief

Reuse the conversation and supplied files first. Ask only for missing choices
that affect the result; bundle related questions rather than asking repeatedly:

- Blog post or glossary term? Topic, audience, purpose, content language and
  desired length or level of detail? For a term, what exact term is defined?
- Which facts, sources, examples and existing entries should be used? Which
  actual relative file paths and images are available in the Nextcloud folder?
- Is this a draft or explicitly approved for publication? What publication
  date/time should it use? For an existing entry, preserve its date and slug
  unless the owner asks to change them.
- Should readers be able to add comments, or should the page keep existing
  comments readable without a posting widget? Does the owner also want to
  close posting on the Remark42 server through its administrator interface?

If answers are unavailable, create a draft (`publish: false`), retain the
normal comment behavior, and report unresolved choices separately from the
file. Do not invent sources, personal experience, dates or asset paths.
Do not delay a requested draft just because optional preferences are missing.
Use an explicitly supplied date; ask when a publication date is needed.

## File contract

- Save UTF-8 files ending in `.md` inside the Nextcloud folder already used by
  Muffelblog. Subfolders are supported, for example `posts/` and `glossary/`.
  These names are conventions, not requirements or type selectors.
- The file starts with `---` on its own line, then a YAML mapping, then another
  `---`, a blank line and the Markdown body. Do not put a filename, explanation
  or outer Markdown code fence inside the actual file.
- Only the YAML boolean `publish: true` publishes. `publish: false`, a missing
  field, `"true"`, `yes` and `1` do not publish. Default to a draft unless the
  owner has requested publication. Do not change an existing publication state
  silently. Drafts are excluded from the blog, but the Nextcloud public share
  can still expose its files to people with access to that share.
- Hidden paths and conflict copies are ignored. Use ordinary folders and file
  names. Do not write into application source, Git fixtures or generated HTML
  when the task is to author Nextcloud content.
- Quote YAML text that contains punctuation such as `: ` or `#`. Double-quoted
  strings need escaped double quotes and backslashes; use a YAML library when
  available. Booleans must remain unquoted. Do not use tabs for YAML indentation.

## Supported frontmatter

| Field         | Type and behavior                                                            | Authoring guidance                                                                                                                                              |
| ------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `publish`     | YAML boolean; only `true` publishes                                          | Use `false` for unapproved drafts.                                                                                                                              |
| `title`       | Text; missing falls back to the file name                                    | Supply a clear title. The page already renders it as its main heading.                                                                                          |
| `date`        | Date or date/time text; missing/invalid falls back to file modification time | Supply an explicit valid date for stable chronology. Preserve it on edits.                                                                                      |
| `slug`        | Text; missing derives from the file name                                     | Set a stable lowercase `a-z`, digits and hyphens identifier. Do not rename it casually.                                                                         |
| `description` | Text used for the page description and feed excerpt                          | Supply a short, self-contained summary; for a glossary entry, a concise definition.                                                                             |
| `tags`        | A list of text values                                                        | Prefer a small set of existing, relevant lowercase tags; do not invent a new taxonomy without need.                                                             |
| `type`        | Omit for a blog post; `glossary` for a term                                  | Do **not** write `type: post` or `type: blog`; they are unknown values and warn. `page` is for separate static pages, outside this guide's scope.               |
| `term`        | Text, glossary only                                                          | Supply the exact term, especially when `title` is a question. Used for glossary display and alphabetical sorting.                                               |
| `comments`    | Optional YAML boolean; default enabled                                       | `false` removes the posting widget while preserving existing static comments. `true` or omission restores the normal widget, subject to Remark42's own closure. |

Do not invent frontmatter switches such as `disable_comments`, `comments_closed`,
`draft`, `lang`, `theme` or graph settings. Unknown fields are ignored; `draft:
true` does not replace `publish: false`. Site UI language, theme palettes and
other deployment settings are configured separately. Content may be written in
the owner's chosen language; Muffelblog does not translate it automatically.

### Dates and addresses

- `date: "2026-11-06"` means noon in Europe/Berlin.
- `date: "2026-11-06T09:30"` means Berlin local time (including daylight saving).
- A timestamp with `Z` or an explicit offset represents that exact instant.
  Use the correct seasonal offset; do not assume Berlin is always `+01:00`.
- A file `posts/understanding-caches.md` with `slug: understanding-caches` is
  published at `/p/understanding-caches/`.
- A term with `slug: cache` is published at `/g/cache/`, regardless of its folder.
  `term` and `title` do not override an explicitly supplied slug.
- Automatic slugs transliterate umlauts (`ä` to `ae`, `ß` to `ss`) and normalize
  punctuation. Duplicate slugs within a type receive suffixes such as `-2`.
  Check the existing files and choose a unique slug rather than relying on this.
- Tags are lowercased, a leading `#` is removed, spaces are collapsed and
  duplicates removed. Nested Memos tags stay a single tag; do not infer a folder
  hierarchy from tags. Inline hashtags in a post do not populate its tag list.

## Comment choices and their limits

Ask about comments if the owner has not already decided. If they ask to disable
comments while retaining the discussion, write the unquoted `comments: false`.
After the next build, existing sanitized static comments remain readable, and
there is a localized closed notice instead of the posting widget. No comments
are deleted. Do not add a fake comment form, comment shortcode or raw widget HTML.

This frontmatter controls the blog page. It does **not** change Remark42's
server state. For server-side closure, the owner signs in to Remark42 with the
administrator email whose authenticated user ID has UI privileges and chooses **Disable comments** for that page.
**Enable comments** reopens it. This also works for memos, which have no Markdown
frontmatter. Do not ask for passwords or claim to have clicked these controls.

The controls are independent. `comments: true` does not reopen a discussion
closed in Remark42. To reopen both, remove `comments: false` (or change it to
`true`), rebuild, then use **Enable comments** in Remark42 if it is still closed.
If the owner only requests a Remark42 action, do not silently change frontmatter.

## Markdown body rules

- Write the content directly after the YAML header. Do not repeat the title as
  the opening body heading. Muffelblog supplies the page's `h1` and shifts body
  headings down one level: Markdown `#` becomes `h2`, `##` becomes `h3`, etc.
  Start sections with `#`, subsections with `##`, without skipping levels.
- Standard Markdown and GitHub-flavored Markdown are supported: paragraphs,
  emphasis, lists, blockquotes, tables, fenced code blocks and task lists.
  Add a language to code fences. Separate paragraphs and lists with blank lines.
- Do not use Obsidian wikilinks or embeds (`[[Term]]`, `![[photo.jpg]]`). Such
  syntax outside code causes the entire published file to be skipped. Use
  `[Term](../glossary/cache.md)` and `![Descriptive alt text](../images/photo.jpg)`.
  Turn off Obsidian's "Use Wikilinks" setting.
- Internal file links are relative to the current Markdown file, stay within
  the shared content folder, and point to actual published `.md` files. A link
  to a missing or unpublished Markdown target becomes plain text and warns.
  Do not invent related entries. If paths are unknown, omit the link and flag
  the proposed connection outside the deliverable. Links create graph edges and
  backlinks automatically; no graph syntax or metadata is needed.
- Ordinary HTTPS source links are allowed; cite real sources rather than
  fabricated references. Linking a site can send a webmention when the operator
  has enabled that feature. Do not add tracking parameters unnecessarily.
- Prefer actual local images with meaningful alt text. PNG, JPEG, WebP, GIF and
  AVIF are supported; HEIC conversion needs the builder's HEIC support. SVG is
  rejected. Default image size limit is 25 MB (operator-configurable). The build
  generates WebP variants and removes EXIF/GPS metadata. Missing images warn and
  produce placeholders; do not reference assets that were not supplied.
- Remote images are restricted to the configured allowlist (by default
  `upload.wikimedia.org`, `raw.githubusercontent.com` and
  `user-images.githubusercontent.com`). An ordinary external link does not
  grant permission to embed that site's images.
- Raw HTML is sanitized. Do not rely on scripts, forms, inline styles, custom
  components, MDX, template syntax or embedded widgets. Prefer portable Markdown.
  Do not generate iframe snippets; ask about supported media if a video is needed.

## Writing quality

For a blog post, lead with the useful point, develop a clear argument or
explanation, and include concrete examples or steps appropriate to the brief.
Separate established facts, opinions and uncertainty. Avoid invented experience,
unsupported claims, filler and repetitive summaries. Keep the owner's voice.

For a glossary entry, define the term in the first paragraph. Explain how it
works or when it matters, give a short example, and distinguish it from an easily
confused concept when useful. Use `term` for the canonical name and `description`
for a definition that works on its own. A term belongs to the glossary and Terms
feed, rather than the Posts feed. Do not expand a concise definition into an
unrelated long essay merely to match a blog template.

## Complete draft examples

These two files form a small example set. Their paths are illustrative; check
the real folder before reusing them. Dates are examples, not today's date.
Both remain drafts until the owner approves `publish: true`. The relative link
will resolve once the target term is also published.

File: `posts/understanding-caches.md`

```markdown
---
publish: false
title: "Why a cache can return yesterday's data"
date: '2026-11-06'
slug: understanding-caches
description: 'A practical explanation of cached data and why freshness needs an explicit policy.'
tags: [software, caching]
comments: true
---

A cache saves repeated work by reusing a previous result. That result may be
older than the source, so faster access comes with a freshness decision.

# A small example

Suppose an application caches a product price for five minutes. A price change
in the source does not necessarily invalidate that saved result immediately.
The application can keep showing the previous price until the result expires.

# Choose a freshness policy

Decide how much staleness the use case permits. Expiration limits the lifetime
of a cached result; invalidation removes it when a relevant change is known.

For the basic definition, see [Cache](../glossary/cache.md).
```

File: `glossary/cache.md`

```markdown
---
publish: false
type: glossary
term: 'Cache'
title: 'What is a cache?'
date: '2026-11-06'
slug: cache
description: 'A cache stores reusable data or results to reduce repeated retrieval or computation.'
tags: [software, caching]
comments: false
---

A **cache** stores data or computed results so a later request can reuse them
instead of retrieving or calculating them again.

# Example

A browser can reuse a cached image rather than download the same file for
every page view, subject to the response's caching rules.

# Freshness

A cached value can become stale when its source changes. Expiration and
invalidation policies determine when it must be refreshed or discarded.
```

## Final review and delivery

Before delivering, check:

1. The YAML is one valid mapping; the intended booleans are unquoted. Use only
   supported fields, omit `type` for posts, and set `type: glossary` for terms.
2. Publication and comment choices match the brief. Draft status is expressed
   through `publish: false`. Do not accidentally publish a template or draft.
3. Dates are valid, slugs unique and stable, tags appropriate, and descriptions
   meaningful. No unresolved placeholders remain in a file marked for publication.
4. Every internal target and local image exists, paths are relative to the file,
   and linked entries are published when the link must work. No wikilinks remain.
5. Facts and citations are supported. Headings are structured, code fences closed,
   and there are no duplicate titles, unsupported widgets or invented assets.
6. When repository tooling is available, validate with Muffelblog's actual
   `parseArticle` / `loadArticles` and `renderMarkdown` helpers and inspect build
   warnings. A generic YAML parser alone does not validate Muffelblog semantics.
   Do not change source code, fixtures or deployment settings to make content pass.
   If no tooling or Nextcloud access is available, report that validation limit.

Return each relative filename and the complete file content. If providing text
in chat, put each file in its own fenced block, keeping the filename outside it;
when saving a real file, omit the outer fence. Put unresolved questions, proposed
assets and any manual Remark42 action in a separate short note. Never claim a
file was uploaded, published, built or moderated unless that action was actually
performed and verified. Do not overwrite existing Nextcloud files blindly.
