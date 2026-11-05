---
type: Feature
title: Glossary and knowledge graph
description: Glossary entries as a third kind of content in the feed with a letter view, search, linking between terms and posts, and a knowledge graph.
tags: [glossary, graph, backlinks, linking]
status: draft
generated: { by: claude-code/web, at: 2026-11-03T12:30:00Z }
---

# Decisions

* **[E]** There is a glossary modeled on newworkglossar.de. The user pasted the
  HTML source of the home page; the site itself was not reachable from the
  session. Only the home page was observed, **not** a single term page.
* **[E]** New glossary entries appear in the chronological stream of the blog.
  In addition there is a selection by letter and the search.
* **[E]** The source is the same Nextcloud folder. A Markdown file with the
  frontmatter field `type: glossary` is a glossary entry (field name and value
  in English like the other fields, decided on 2026-11-03). Pipeline, rendering
  and sanitizing are the same as for articles.
* **[E]** Linking uses normal Markdown links to own pages, not wikilinks. The
  rule "wikilink = skip the file" stays.
* **[E]** A knowledge graph shows the linking between terms and posts: a local
  graph per page and an overall view `/graph/`.
* **[E]** Filters in the feed: All, **Lang** (blog posts), **Kurz** (memos) and
  **Begriffe** (glossary terms). Terms are kept separate from blog posts:
  `Lang` never contains terms. In **All** the terms appear in the chronological
  stream, marked as a term. The series is `/terms/` and `/terms/page/N/`.
* **[E]** The split view is dropped. The unified mode with a filter stays the
  only view of the feed (see [Feed](/frontend/feed.md)).

# Observations on the model (home page)

* A header with a logo and a sentence on the purpose, below it a bar A to Z. The
  letters there are `span` elements, not links (jump by script).
* Below that all terms, grouped by letter, one heading with an `id` (`A` to `Z`)
  per letter. Every entry is a link to a page of its own.
* The link text is a **question** ("Was ist Agilität?", "Wie funktioniert
  Selbstorganisation?"), the term in it is highlighted. The grouping follows the
  term, not the question word.
* The URL derives from the question (`/was-ist-agilitaet/`), sits directly at the
  root, with umlauts as `ae`, `oe`, `ue`.
* Terms with special characters stand under the first letter (`Coach*in` under
  C). There are no dates, no tags and no graph on the home page. Some terms are
  not strictly alphabetical (for example "self-made man" at the end of S).
* A footer with privacy policy, imprint and further links. The model embeds
  foreign scripts (cookie banner, form embed). We do not take that over.

# Proposal: glossary

* **[V]** URL of a term: `/g/<slug>/`. The slug is built from the title like for
  articles, with a counter for duplicates within the glossary. The namespace is
  separate from `/p/`, so a term can never displace an article.
* **[V]** Fields like for articles (`title`, `date`, `tags`, `description`,
  `publish`) plus an optional field for the term. The title may be a question
  like in the model ("Was ist Agilität?"). The term ("Agilität") determines
  letter and sorting and is highlighted in the title. If the field is missing,
  the title counts as the term. The description is the short definition for the
  feed excerpt.
* **[V]** The feed gets a third kind `glossary` and a fourth filter. An entry
  shows term, date and short definition, not the whole text.
* **[V]** Letter view `/glossary/`: a bar A to Z and all terms grouped by the
  first letter of the term. The letters of the bar are real links (anchors), not
  only script elements. Umlauts count as the base letter (Ä under A), digits and
  special characters under `#`. The page is static and complete, with the
  expected amount (a few hundred terms) one page is enough.
* **[V]** Search finds terms through Pagefind, with a filter by kind. RSS and the
  sitemap contain terms.

# Proposal: linking and graph

* **[V]** A Markdown link to a file in the folder (a relative path, for example
  `file.md` or `../folder/file.md` as the target) is resolved at build time
  against the published files and leads to the page of the target (`/p/<slug>/`
  or `/g/<slug>/`). This is **new behavior**: today the renderer leaves relative
  links unchanged. A link to an unknown or unpublished file becomes plain text
  and produces a warning.
* **[V]** Nodes are articles and terms. Memos are not nodes, they have no title
  and are sanitized in the strict mode. Edges are resolved links, directed,
  without duplicates and without self-references.
* **[V]** Every page shows two lists: "Links to" and "Linked from" (backlinks).
  The lists are plain HTML and the access without JavaScript, for screen readers
  and search engines.
* **[V]** The build writes `graph.json` (nodes with kind, title, URL; edges). The
  browser draws a graph from it as SVG with a small piece of vanilla TS, locally
  with the direct neighbors, complete in `/graph/`. No foreign library, no
  request to third parties.
* **[V]** Publishing protects: edges to files without `publish: true` never
  arise. Otherwise titles and slugs of unpublished files would leak through
  `graph.json`.

# Risks

* **Value of the graph:** with few nodes the graph is decoration. The backlink
  lists carry the benefit. The graph becomes useful only when terms and posts
  link densely.
* **Obsidian setting:** Obsidian creates Markdown links only if "Use Wikilinks"
  is off (see [Nextcloud source](/content/nextcloud-source.md)). The graph of
  Obsidian itself is not affected.
* **Paths in the link:** Obsidian encodes spaces as `%20`. The resolution must
  decode that and compare against Unicode normalization (NFC).
* **Size of `graph.json`:** grows with nodes and edges. Not critical at the
  expected amount, a threshold is set in W21.

# Decided 2026-11-05 (O38)

* **[E]** Optional field `term:` for a glossary entry: the term itself, when
  the title is a question. The letter view shows and sorts the term (or else the
  title). The address still comes from the file name or `slug:`.
* **[E]** Terms have comments like posts and memos.
* **[E]** Umlauts sort under the base letter (collator `de`).

# Open

Display of memos in the graph, structure of a single term page in the model
(not observed).
