---
type: Feature
title: Notes in the margin
description: Comments of the Obsidian plugin Document Comments and footnotes next to the paragraph they belong to, below it on narrow screens.
tags: [margin, comments, footnotes, obsidian]
status: draft
generated: { by: claude-code/web, at: 2026-11-20T12:30:00Z }
---

# Decisions (owner, 2026-11-20)

* **[E]** The plugin [Document Comments](https://github.com/kylemcd/obsidian-document-comments)
  is the way to write notes for readers in Obsidian. Its comments appear on the
  site in the margin, next to the paragraph.
* **[E]** **Every open comment is public**, without a marker: the owner is the only
  author and accepts that. Resolved comments (`status:resolved`) never appear, nor
  their thread. (Anyone who adds a second author must reconsider this: the whole
  thread with author names is published.)
* **[E]** Footnotes also stand in the margin, next to their reference; the list
  at the end of the page stays (print, feeds, no JavaScript).
* **[E]** No special admonition (callout) as margin note.
* **[E]** Narrow screens (under 1100 px): the notes stand below their paragraph,
  closed ("Comment by Peter", "Footnote 1"), and open with a click. Without
  JavaScript they stay open there.

# Format of the plugin (what is read)

The plugin stores a comment in the note as HTML comments:

```markdown
We should <!--c:k3f9-->ship on Friday<!--/c:k3f9--> regardless of the QA timeline.
<!--co:k3f9 by:kyle at:2026-06-17T10:00:00.000Z status:open quote:"ship on Friday"
kyle (2026-06-17T10:00:00.000Z): I thought we agreed Thursday?
sam (2026-06-17T10:05:00.000Z): Thursday is better for QA.
-->
```

* **[E]** `<!--c:ID-->` and `<!--/c:ID-->` mark the passage (shown with a
  highlight); the `<!--co:ID ...-->` block holds `status` and the thread. A line
  `name (time): text` starts a message, a line without that form continues the
  message before it, lines with a leading `+` (reactions) are ignored. The text of
  a message is Markdown (bold, links, lists ...) through the sanitizer; raw HTML in it
  is dropped. A zero width space in front of a marker is removed.
* **[E]** Every other HTML comment of a note is removed from the page, as before.
  A marker without its end, or a `co` block without markers, shows nothing.
* **[U]** The format is taken from the README of the plugin, not checked against
  a vault written by it. Comments on fenced code blocks (line ranges) and inside
  table cells are not shown as notes (the marker is dropped, the text stays).

# Implementation

* `packages/core/src/margin-notes.ts`: a step at the end of `renderMarkdown`
  (after sanitizing, after the links of the page are resolved, after the glossary
  links). The paragraph (the block at the top of the page) with notes becomes
  `div.annotated`, its notes `aside.margin-note > details[open]` (comment or
  footnote), in the order of the text. The sanitizer keeps HTML comments for
  exactly this step (`allowComments`), the step removes all of them.
* Wide screen (from 1100 px, on the page of a post, memo or term): a grid with
  the paragraph left and the notes right of it, the text column moves left to
  make room (the same width as before). A small script closes the notes on narrow
  screens and opens them when the window gets wide.
* The notes are cut out of excerpts and the RSS content (`withoutMarginNotes`),
  and not shown in lists of entries (a memo in the feed).
* Fixed on the way: footnote ids carried the prefix `user-content-` twice, so the
  jump from the reference to the list and back led nowhere.
