---
title: Writing posts, terms and pages
description: The frontmatter fields, the three kinds of files and how images and links work.
---

Everything you write is a Markdown file with a YAML header ("frontmatter"). A
file is published **only** if it says `publish: true`. Everything else in the
folder stays private.

```markdown
---
publish: true
title: A post about timber joints
created: 2026-11-04
updated: 2026-11-04
tags: [holzbau, grundlagen]
description: One sentence for search engines and the feed.
---

The text starts here.
```

## Fields

| Field         | Required | Rule                                                                                                   |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `publish`     | yes      | Only the boolean `true` counts. `"true"` or `yes` do not.                                              |
| `title`       | no       | Missing: the file name.                                                                                |
| `created`     | no       | Creation date. Missing or invalid: the modification date of the file, with a warning. Replaces `date`. |
| `updated`     | no       | Date of the last edit. Missing or invalid: the modification date of the file, with a warning.          |
| `tags`        | no       | A list. Tags are lowercased, a leading `#` is dropped.                                                 |
| `description` | no       | Used as meta description and feed excerpt.                                                             |
| `slug`        | no       | The last part of the address. Missing: derived from the file name.                                     |
| `type`        | no       | `glossary` or `page`. Missing: a post.                                                                 |
| `term`        | no       | Glossary only: the term, when the title is a question.                                                 |

Unknown fields (`aliases`, `cssclasses`, ...) are ignored.

### Dates

- `2026-11-04` counts as 12:00 in Europe/Berlin.
- `2026-11-04 09:30` or `2026-11-04T09:30` counts as Berlin local time.
- With `Z` or an offset (`+02:00`) exactly that moment counts.

### Slugs

Umlauts become `ae oe ue`, `ß` becomes `ss`, everything else is lowercase letters,
digits and `-`. If two posts end up with the same slug, the older one keeps it
and the other gets `-2`; a warning is logged. **Renaming a file changes its
address** unless you set `slug:`.

## Three kinds of files

### Posts (default)

Address `/p/<slug>/`. They appear in the feed filter _Lang_, in the RSS feed, in
search and in the sitemap.

### Glossary terms: `type: glossary`

Address `/g/<slug>/`. The title is the term, the description is the short
definition shown in lists. The title may also be a question ("Was ist ein
Cache?"): then set `term: Cache`, and the letter view shows and sorts the term.
Terms have a comment section, like posts and memos. Terms appear in the feed under _Begriffe_ (and in
_Alle_, marked as terms), never under _Lang_. `/glossary/` lists all terms by
first letter; umlauts count under their base letter, digits under `#`. A term and
a post may share a slug, because the addresses are separate.

### Links between your files

Link to another file of the folder with its path, as Obsidian writes it with
"Use Wikilinks" off: `[Cache](glossar/cache.md)` or `[Post](../other-post.md)`.
The link leads to the page of that file. A link to a file that is not published
(no `publish: true`) or does not exist becomes plain text, and the build warns;
its name never appears on the site.

Every post, term and memo shows **Links of this page**: what it links to
(external websites as one entry per domain) and what links to it, with a small
graph of these neighbors. `/graph/` shows all of them.

### Static pages: `type: page`

Address `/<slug>/`, for example `impressum` or `datenschutz`. Pages need no date,
are not part of the feed, RSS or search, and appear as links in the footer on
every page. Names that belong to the site itself (`p`, `m`, `g`, `tag`, `page`,
`posts`, `memos`, `terms`, `glossary`, `search`, `media`, `pagefind`, `feed`,
`sitemap`, `robots`, ...) are refused with a warning.

## Images

Put images in the same folder and use normal Markdown links:
`![A mortise](images/mortise.jpg)`.

- PNG, JPEG, WebP, GIF and AVIF up to 25 MB. SVG is rejected.
- HEIC photos (iPhone) are converted to JPEG by the builder image. If you run the builder without that image, convert them to JPEG first: HEIC files are skipped with a warning.
- They are scaled to several widths (480 to 1920 px), served as WebP, and **all
  metadata (EXIF, GPS) is removed**.
- A missing image does not stop the build; a placeholder with the alt text appears.
- Images from other sites are allowed only from `upload.wikimedia.org`,
  `raw.githubusercontent.com` and `user-images.githubusercontent.com`.
  YouTube videos (`youtube-nocookie.com`) load only after a click.

## Obsidian

Turn **off** "Use Wikilinks" (Settings, Files and links). Files that contain
`[[wikilinks]]` are skipped with a warning, because they cannot be resolved.

## Code

Fenced code blocks with a language are coloured at build time.
