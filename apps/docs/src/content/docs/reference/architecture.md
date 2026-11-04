---
title: Architecture
description: The services, the volumes and how a release is built and switched.
---

## Services

| Service    | Image                                         | Job                                                                                 |
| ---------- | --------------------------------------------- | ----------------------------------------------------------------------------------- |
| `builder`  | built from the repository (`target: builder`) | Checks the sources, builds the site, keeps the releases                             |
| `web`      | Caddy 2.11                                    | Serves `releases/current`, sets the headers, forwards the comments host to Remark42 |
| `remark42` | `umputun/remark42` (pinned)                   | Comments, login by email                                                            |
| `mailpit`  | `axllent/mailpit` (pinned)                    | Local mail sink; not used in production                                             |

Nextcloud and Memos are yours and run elsewhere.

## Volumes

| Volume         | Written by | Content                                                                                       |
| -------------- | ---------- | --------------------------------------------------------------------------------------------- |
| `releases`     | builder    | `releases/<id>/` and the link `current` (a host folder in production)                         |
| `cache`        | builder    | The last downloaded copies of the Nextcloud folder                                            |
| `state`        | builder    | What was built last (`scheduler.json`), the status (`status.json`), the Nextcloud fingerprint |
| `remark42-var` | Remark42   | The comments                                                                                  |
| `caddy-data`   | Caddy      | Certificates                                                                                  |

## One build

1. The builder reads a **marker** of each source: a fingerprint of the Nextcloud
   file list, of the public memos and of the latest comments.
2. A changed marker must stay the same for `MUFFEL_DEBOUNCE_CHECKS` further checks.
3. Nextcloud is downloaded into a new folder and checked against its listing.
4. Astro builds the site into a staging folder, then Pagefind indexes it.
5. The result is copied to `releases/<id>/`, **`build.json` is written last**, and
   the relative link `current` is replaced by a new one in a single rename.
6. Old releases beyond `MUFFEL_RELEASES_KEPT` are removed. A folder without
   `build.json` (a build that was killed) is removed at the next start.

If any step fails, the folder being built is deleted and `current` is not touched.

## Security in short

- Every Markdown text, memo and comment goes through one sanitizer; scripts,
  event handlers, `javascript:` links, forms, styles and SVG are removed.
- The site loads no scripts or styles from elsewhere. The Content Security Policy
  has no `unsafe-inline`; the build therefore emits no inline scripts or styles.
- Images from other sites only from three named hosts; frames only from
  `youtube-nocookie.com` (after a click) and your comments host.
- The administrator login of Remark42 is never accepted from outside, and the
  builder reaches Remark42 inside the Docker network only.
- The Nextcloud share needs a password; the builder does not pass its secrets on
  to the site build.
- The builder container still runs as root. Hardening is planned.
