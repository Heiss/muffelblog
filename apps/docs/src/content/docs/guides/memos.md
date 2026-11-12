---
title: Connect Memos
description: Show the public memos of your Memos instance as short posts.
---

[Memos](https://usememos.com) is for the short things. The builder reads your
**public memos** and gives each one its own page and a place in the feed.

## What is needed

- A running Memos instance that the **builder can reach** (from the builder
  container, so use an address that works there).
- The instance must allow anonymous reading of public memos. Without that it
  answers "not logged in" and the build stops.
- Memos you want on the blog have visibility **Public**. Everything else is ignored.
- No token: the builder reads like an anonymous visitor.

**Check:** open your Memos address in a private browser window, without logging
in. If you can read a public memo there, the builder can too. (This is the
reading of the Memos behaviour by the project, not a test against every
version.)

```sh
MEMOS_URL=https://memos.example.org
```

The tested Memos versions are listed in [Supported versions](/muffelblog/reference/versions/); its API changes between versions, and the
contract tests in CI run against those versions.

## How memos appear

|             |                                                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Address     | `/m/<id>/`                                                                                                                    |
| Title       | Always date and time, for example "Memo vom 2. Nov. 2026, 14:32" (Berlin time)                                                |
| Tags        | `#tag` in the text. Nested tags (`#a/b`) stay one tag; the address form is `a-b`.                                             |
| Images      | Mirrored to your own server at build time. The browser never contacts the Memos instance.                                     |
| Other files | PDF, audio and video are mirrored up to the size limit (`MUFFEL_MEMOS_MAX_FILE_MB`, default 25). Everything else is left out. |
| Links       | Only to your own pages, never to the Memos instance.                                                                          |

## Failure behaviour

If Memos cannot be read completely, the build **stops** and the last good
version stays online; the failure is reported once and again when it is over.
Edits, new memos and deleted memos are noticed through a fingerprint of the
public memos (text, date, edit time, tags, attachment names and sizes). A changed attachment
that keeps its name and size is not noticed.
