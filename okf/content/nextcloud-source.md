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

# Implemented (W02, 2026-11-03)

* **[E]** Tool: `rclone` (pinned `1.75.2`, copied into the builder image) over
  WebDAV at `<NEXTCLOUD_URL>/public.php/webdav/`, user = share token, password =
  share password. The rclone vendor is `other`: the contract test showed that
  `nextcloud` refuses any address that does not end in `/dav/files/USER`, which
  a public share never does. The connection goes through `RCLONE_WEBDAV_*` environment
  variables, the password is obscured through stdin, so it never appears in a
  process list or in logs.
* **[E]** Configuration: `NEXTCLOUD_URL`, `NEXTCLOUD_SHARE_TOKEN` and
  `NEXTCLOUD_SHARE_PASSWORD` (or `NEXTCLOUD_SHARE_PASSWORD_FILE` for Docker
  secrets, never both). The password is mandatory. `NEXTCLOUD_URL` together with
  `MUFFEL_FIXTURES` stops the build.
* **[E]** Change detection: `rclone lsjson -R` gives path, size and
  `ModTime` (the WebDAV `getlastmodified`, one-second resolution). A SHA-256 over
  the sorted list is remembered in `state/nextcloud.json`; same value, same
  files in the cache: no download, no build. Content that changes within the same
  second and with the same size is not noticed; Nextcloud updates the time on
  every write, so this is only a theoretical gap.
* **[E]** Safety: the download goes into a new folder
  `cache/nextcloud/<id>/`, is checked against the listing (same files, same
  sizes) and only then the link `current` is switched (the same atomic swap as
  for releases). A failed list, a failed or incomplete download and an **empty**
  list (also on the first run) leave the cache and the remembered state as they
  were and stop the run. Paths with `..` or leading `/` are refused. The last 2
  copies are kept.
* **[E]** Hidden folders and files (`.obsidian/`, `.trash/`, `.*`) are not
  listed and not downloaded, so Obsidian's own changes never trigger a build.
* **[E]** Contract test: CI starts Nextcloud 35, creates a folder, a share with
  password and files through the real APIs, and checks listing, filtering,
  sync, change detection and a wrong password.

# Access (original proposal)

* **[V]** Sync with `rclone` (WebDAV) into the `cache` area, polling every 3
  minutes.
* **[E]** Public shares are reachable through WebDAV at `/public.php/webdav/`.
  The user name is the share token, the password is the share password (checked
  by the contract test against a real Nextcloud 35; rclone needs the vendor
  `other` for this address, `nextcloud` is rejected).
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
