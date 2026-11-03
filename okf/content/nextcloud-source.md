---
type: Data Source
title: Nextcloud source
description: Public share of a Nextcloud folder as the only source of the articles.
tags: [nextcloud, webdav, sync, obsidian]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Decisions

* **[E]** The folder is provided as a public share, with a password.
* **[E]** The builder uses the root of the share, the folder name does not
  matter.
* **[E]** Nextcloud is the only source. Editing is done with Obsidian (also on
  mobile), in an emergency with Nextcloud Notes.
* **[E]** Only files with `publish: true` are taken into account (see
  [Frontmatter](/content/frontmatter.md)).
* **[E]** If the Nextcloud version or the Memos version changes, the newest
  one should run.

# Access

* **[V]** Sync with `rclone` (WebDAV) into the `cache` area, polling every 3
  minutes.
* **[U]** Public shares are reachable through WebDAV at `/public.php/webdav/`.
  The user name is the share token, the password is the share password. This
  must be checked against the Nextcloud version before implementation.
* **[V]** Change detection through the file list with size and modification
  date or ETag, so a build happens only on a real change.

# Risks

* The share link makes the whole folder retrievable, including drafts,
  `.obsidian/` and files without `publish: true`. The password is the only
  layer of protection. The password is therefore mandatory and a secret (see
  [Docker](/architecture/docker.md)).
* Obsidian mobile synchronizes half-finished files. Countermeasures: opt-in
  through `publish`, debounce in the scheduler (see
  [Pipeline](/ops/pipeline.md)).
* Nextcloud creates copies on conflicts.

# Exclusions

**[V]** When reading, the following are ignored:

* folders and files that start with `.` (`.obsidian/`, `.trash/`)
* conflict copies (pattern `*(conflicted copy)*` and the variants Nextcloud
  uses)
* files without the `.md` extension (except referenced media, see
  [Media](/content/media.md))
* files without `publish: true`

# Obsidian settings

* **[E]** No wikilinks.
* **[V]** "Use Wikilinks" must be off in Obsidian, otherwise image embeds
  appear as `![[image.png]]`, which the build does not resolve. The build
  should recognize wikilink syntax and skip that file with a warning, instead
  of producing broken HTML.
