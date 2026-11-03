---
type: Policy
title: Media
description: Handling of images and foreign content in articles and memos.
tags: [images, media, privacy, embeds]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Decisions

* **[E]** Memo images are mirrored to the own domain at build time.
* **[E]** Articles may load foreign content, but only from allowlists (O5).
  This deviates from the rule "the browser loads nothing from third-party
  services" and applies only to articles, not to memos.
  * Remote images (https only): `upload.wikimedia.org`,
    `raw.githubusercontent.com`, `user-images.githubusercontent.com`.
  * Embeds: `www.youtube-nocookie.com`, path `/embed/<11 characters>`. They
    start only after a click, before that no request goes to YouTube.
* **[E]** Local article images (O7): scale down, serve as WebP, remove EXIF.

The lists live in the code (`packages/core/src/policy.ts`) and will later feed
the Content Security Policy. A new domain is a code change with a test.

# Local article images

* Images live in the Nextcloud folder and are included through a relative
  Markdown path (`![](path/image.png)`, spaces as `%20`).
* **[V]** The path is relative to the note. If the file is not found there and
  the path does not start with `./` or `../`, it is then taken from the folder
  root (this is how Obsidian writes absolute vault paths).
* Allowed are PNG, JPEG, WebP, GIF and AVIF up to 25 MB. SVG is rejected.
* Output: WebP in the widths 480, 960, 1440 and 1920 (as far as the original
  is wide enough, never enlarged), `srcset`, width and height,
  `loading="lazy"`. An image narrower than 480 px is served at its original
  width.
* The EXIF orientation is applied, then all metadata is dropped (GPS, camera,
  color profile). Animated GIFs stay animated.
* File names of the variants consist of an identifier of the content
  (`<16 hex characters>-<width>.webp`) under `/media/`. The same image is
  processed only once.
* Rejected: paths outside the content folder (`../`, absolute paths), hidden
  folders (`.obsidian/`), links (symlinks) leading out of the folder, paths
  with `?` or `#`.
* Only images that a published article uses reach the build.
* A missing or unusable image does not make the build fail. A placeholder with
  the alt text appears, and the log warns.

# Remote images

* Images from allowed hosts stay as an address, with `loading="lazy"`,
  `decoding="async"` and `referrerpolicy="no-referrer"`. They are not mirrored.
* Images from other hosts, with `http`, with credentials or a foreign port,
  `data:` addresses and protocol-relative addresses are removed. The log warns,
  the alt text stays as text.
* Risk: every request of a remote image reveals the IP address of the visitor to
  the host. This is a privacy topic (O15).

# Embeds

* An `<iframe>` in the Markdown is accepted only if its address matches a rule
  exactly (https, exact host, exact path, no parameters, no credentials). All
  attributes of the author are dropped.
* Instead there is a placeholder with a note, a button "load content" and a
  link to the original site. Without JavaScript the link stays.
* After the click a small script inserts an `iframe` with
  `sandbox="allow-scripts allow-same-origin allow-presentation"`,
  `referrerpolicy="no-referrer"` and `loading="lazy"`. It checks the address
  once more against the same policy.
* All other embeds are removed and reported in the log.

# Memo images

* **[E]** Mirrored to the own domain, nothing is loaded from the Memos instance
  (see [Memos](/content/memos-source.md)).
* **[E]** When mirroring, EXIF data is removed, in particular GPS. Phone photos
  from Memos would otherwise carry location data. The same processing
  (`processImage`) as for article images, WebP in several widths.
* **[E]** Alt text: file name without extension, underscores and hyphens become
  spaces (`IMG_2043.jpg` becomes "IMG 2043").
* **[V]** Image formats PNG, JPEG, WebP, GIF and AVIF. HEIC and HEIF are not
  decoded and are skipped with a note (O36).
* **[V]** Size limit per file: 25 MB (configurable, see
  [Configuration](/ops/config.md)). Time limit per fetch: 30 seconds.
  Redirects are never followed.

## Other attachments (O6)

* **[E]** PDF, audio and video are mirrored to the own domain and included: PDF
  as a link with its size, audio and video with `controls` and
  `preload="none"`.
* **[V]** Only these extensions are allowed: `pdf`, `mp3`, `m4a`, `ogg`, `opus`,
  `wav`, `flac`, `mp4`, `m4v`, `webm`, `mov`. The start of the data must match
  the extension (file signature), otherwise the file is rejected.
* **[V]** Everything else (HTML, SVG, scripts, archives, programs, office files)
  is not accepted, because the server could otherwise serve such files under the
  own address with an active content type. The file name is made URL-safe
  (`<16 hex characters>-<name>.<extension>`).
* **[V]** Serving uses a fixed table from extension to content type, never the
  type from Memos. Unknown extensions give 404.
* Externally stored attachments (`externalLink`) are not loaded.
* A missing attachment (HTTP 404) leaves the memo in place and warns. Network
  and server errors stop the build.

# Open questions

Fetching foreign URLs for mention avatars (W14) is not implemented yet. It
needs the SSRF protection from [Sanitizing](/security/sanitization.md).
