---
title: What is it?
description: What Muffelblog does, what it does not do, and how the parts fit together.
---

Muffelblog is a blog engine for one author who wants to write in the tools they
already use.

## What you get

| Feature          | How it works                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Posts**        | Markdown files with `publish: true` in a Nextcloud folder, written with Obsidian or any editor. Page: `/p/<slug>/`    |
| **Memos**        | Public memos of your [Memos](https://usememos.com) instance, in full in the feed. Page: `/m/<id>/`                    |
| **Glossary**     | Files with `type: glossary`. Page: `/g/<slug>/`, overview with letters: `/glossary/`                                  |
| **Static pages** | Files with `type: page`, for example Impressum and Datenschutz. Page: `/<slug>/`, linked in the footer                |
| **Feed**         | One stream of posts, memos and terms, filter _Alle / Lang / Kurz / Begriffe_, endless scroll with working back button |
| **Search**       | Full text over posts, memos and terms, filter by kind and tag, runs in the browser (Pagefind)                         |
| **RSS**          | `/feed.xml` with the full text of posts and memos (needs `SITE_URL`)                                                  |
| **Comments**     | Remark42, login by email only, a sanitized copy in the HTML                                                           |
| **Themes**       | Ten colour schemes, no flash on load, no external fonts                                                               |
| **SEO**          | Titles, descriptions, canonical addresses, Open Graph, `h-entry` markup, sitemap, `robots.txt`                        |

## What it does not do

- It is not a multi-user CMS. One author, one Nextcloud folder, one Memos instance.
- Posts are not translated. The interface language is a setting
  (`MUFFEL_LANG`, `en` by default or `de`), one language per build. Someone who
  wants both runs two instances.
- Webmentions, a link graph and backlinks are planned, not built.

## How the parts fit together

```text
Nextcloud (public share) ─┐
                          ├─► builder ─► releases/<id>/ ─► current ─► web server ─► readers
Memos (public memos)    ──┤   (checks every 3 minutes,        ▲
Remark42 (comments)     ──┘    builds on change)              └── atomic switch, last good one stays
```

The **builder** checks Nextcloud, Memos and Remark42 every three minutes. If
something changed and stayed the same for one more check, it builds the complete
site into a new folder and switches the link `current` to it in one step. If
anything fails, the previous version stays online and the failure is reported.
See [Architecture](/muffelblog/reference/architecture/).
