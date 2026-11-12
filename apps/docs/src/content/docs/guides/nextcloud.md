---
title: Connect Nextcloud
description: Publish posts from a Nextcloud folder through a password-protected public share.
---

The builder reads your posts from **one folder of your Nextcloud, shared as a
public link with a password**. It never gets your account password.

## 1. Create the folder and the share

1. Make a folder, for example `blog`, and put your Markdown files in it
   (see [Writing](/muffelblog/guides/writing/)). To start with something that
   works, copy the content of the
   [example folder](https://github.com/Heiss/muffelblog/tree/main/examples/nextcloud-folder):
   a first post with an image, a glossary entry and two legal pages. The legal
   pages are **templates with placeholders**, not legal advice.
2. Share the folder: _Share link_, **set a password** (mandatory, see below),
   permission _read only_.
3. The link looks like `https://cloud.example.org/s/AbC123xyz...`. The part after
   `/s/` is the **token**.

**Check:** open the link in a private browser window and enter the password. What
you see is exactly what the builder reads. The steps inside Nextcloud are
described from its documentation and were not checked against a live instance;
the labels differ between versions.

:::caution[The password is mandatory]
A share link gives access to the **whole folder**, including drafts, files
without `publish: true` and `.obsidian/`. The password is the only protection.
The builder refuses to start without one.
:::

## 2. Tell the builder

In `.env`:

```sh
NEXTCLOUD_URL=https://cloud.example.org
NEXTCLOUD_SHARE_TOKEN=AbC123xyz
NEXTCLOUD_SHARE_PASSWORD=the-share-password
MEMOS_URL=https://memos.example.org    # required as well, see the Memos guide
```

Instead of `NEXTCLOUD_SHARE_PASSWORD` you can set `NEXTCLOUD_SHARE_PASSWORD_FILE`
to the path of a file (a Docker secret). Setting both stops the builder.

Then `docker compose up -d`. If `MUFFEL_FIXTURES` (the demo) is set while
`NEXTCLOUD_URL` is set, the builder stops, so sample data can never replace real
content by accident.

## What the builder does with it

- Every check (default 180 s) it lists the folder (path, size, modification time)
  **without downloading** and compares a fingerprint with the last build.
- On a change it waits for one more equal check (so a half-synchronized Obsidian
  file is not published), downloads the folder into a new directory, **checks it
  against the listing**, and only then builds.
- Hidden folders and files (`.obsidian/`, `.trash/`, anything starting with a dot)
  are neither listed nor downloaded, so Obsidian's own changes never trigger a build.
- **An empty folder is an error**, never "everything was deleted". Unreachable
  Nextcloud, wrong password or an incomplete download leave the site as it is and
  are reported (see [Operations](/muffelblog/production/operations/)).

## Good to know

- Over WebDAV only the _modification_ date exists, no creation date. Put a
  `created:` and `updated:` in the frontmatter, otherwise a post moves in the timeline whenever
  you edit it.
- Nextcloud's conflict copies (`(conflicted copy ...)`, `(Konfliktkopie ...)`) are ignored.
- The transport is `rclone` (pinned version, inside the builder image).
