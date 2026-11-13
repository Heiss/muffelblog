---
title: Site map for agents
description: Every page of this documentation with what it is for and when to read it, as rendered page and as raw Markdown. The entry point for AI agents.
---

This is the map of the documentation. Every page has two links: the **rendered**
page and the **raw Markdown** (easier for an agent to read). The docs are the
source of truth; the [install guide for agents](/muffelblog/agent.md) links here.

Raw files live under
`https://raw.githubusercontent.com/Heiss/muffelblog/main/apps/docs/src/content/docs/<path>.md`.

If you are an agent: read the line "Read it when", fetch only the pages you need.

## Start

| Page                                                         | Raw Markdown                                                                                                                              | What is in it                                                                                       | Read it when                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| [What is it?](/muffelblog/start/what-is-it/)                 | [`start/what-is-it.md`](https://raw.githubusercontent.com/Heiss/muffelblog/main/apps/docs/src/content/docs/start/what-is-it.md)           | What Muffelblog does and does not do, and how the parts fit together.                               | You need the big picture before you touch anything. |
| [Getting started](/muffelblog/start/getting-started/)        | [`start/getting-started.md`](https://raw.githubusercontent.com/Heiss/muffelblog/main/apps/docs/src/content/docs/start/getting-started.md) | Real setup behind your own reverse proxy: what is needed, `.env`, start, table of typical problems. | Setting up a real blog.                             |
| [Quickstart](/muffelblog/start/quickstart/)                  | [`start/quickstart.md`](https://raw.githubusercontent.com/Heiss/muffelblog/main/apps/docs/src/content/docs/start/quickstart.md)           | Demo content on your own machine in a few minutes, nothing public.                                  | The person only wants to try it.                    |
| [Install with an AI agent](/muffelblog/start/agent-install/) | [`start/agent-install.md`](https://raw.githubusercontent.com/Heiss/muffelblog/main/apps/docs/src/content/docs/start/agent-install.md)     | The prompt that makes an agent load `agent.md` and install with you.                                | You are an agent and are asked to install.          |

## Guides

| Page                                                          | Raw Markdown                                                                                                                        | What is in it                                                                                                                             | Read it when                                            |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [Writing posts, terms and pages](/muffelblog/guides/writing/) | [`guides/writing.md`](https://raw.githubusercontent.com/Heiss/muffelblog/main/apps/docs/src/content/docs/guides/writing.md)         | All frontmatter fields (`publish`, `created`, `updated`, `type`, `nav`, `tags`, `slug`, `term`), the three kinds of files, images, links. | Writing or fixing a note in the Nextcloud folder.       |
| [Connect Nextcloud](/muffelblog/guides/nextcloud/)            | [`guides/nextcloud.md`](https://raw.githubusercontent.com/Heiss/muffelblog/main/apps/docs/src/content/docs/guides/nextcloud.md)     | The folder and its password-protected public share; what is synced and what is ignored.                                                   | Content does not appear, or the source is being set up. |
| [Connect Memos](/muffelblog/guides/memos/)                    | [`guides/memos.md`](https://raw.githubusercontent.com/Heiss/muffelblog/main/apps/docs/src/content/docs/guides/memos.md)             | Show the public memos as short posts; what must be public.                                                                                | Memos are missing or the source is being set up.        |
| [Comments](/muffelblog/guides/comments/)                      | [`guides/comments.md`](https://raw.githubusercontent.com/Heiss/muffelblog/main/apps/docs/src/content/docs/guides/comments.md)       | Remark42 with login by email, moderation, the static copy.                                                                                | Comments, moderation or mail problems.                  |
| [Webmentions](/muffelblog/guides/webmentions/)                | [`guides/webmentions.md`](https://raw.githubusercontent.com/Heiss/muffelblog/main/apps/docs/src/content/docs/guides/webmentions.md) | Sending and receiving webmentions; both off by default.                                                                                   | The person asks for webmentions.                        |
| [Statistics](/muffelblog/guides/statistics/)                  | [`guides/statistics.md`](https://raw.githubusercontent.com/Heiss/muffelblog/main/apps/docs/src/content/docs/guides/statistics.md)   | Visit counts with the operator's own Matomo, without cookies; off by default.                                                             | The person asks for statistics.                         |

## Operations

| Page                                                            | Raw Markdown                                                                                                                                    | What is in it                                                                                                    | Read it when                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [Reverse proxy examples](/muffelblog/production/reverse-proxy/) | [`production/reverse-proxy.md`](https://raw.githubusercontent.com/Heiss/muffelblog/main/apps/docs/src/content/docs/production/reverse-proxy.md) | Caddy, nginx and Traefik snippets for the blog and the comments host.                                            | Wiring the blog behind a proxy.                 |
| [Operations](/muffelblog/production/operations/)                | [`production/operations.md`](https://raw.githubusercontent.com/Heiss/muffelblog/main/apps/docs/src/content/docs/production/operations.md)       | Status file, failure reports, backups, updates, rollback.                                                        | Checking that the blog is healthy, or updating. |
| [Runbook for disruptions](/muffelblog/production/runbook/)      | [`production/runbook.md`](https://raw.githubusercontent.com/Heiss/muffelblog/main/apps/docs/src/content/docs/production/runbook.md)             | What to do when a source is unreachable, a build breaks, the disk is full, mail does not arrive, a secret leaks. | Something is broken.                            |
| [Proxy serves the files](/muffelblog/production/host-folder/)   | [`production/host-folder.md`](https://raw.githubusercontent.com/Heiss/muffelblog/main/apps/docs/src/content/docs/production/host-folder.md)     | Advanced: the proxy serves the files from a host folder.                                                         | Only if the proxy must serve the files itself.  |

## Reference

| Page                                                  | Raw Markdown                                                                                                                                  | What is in it                                                        | Read it when                               |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------ |
| [Configuration](/muffelblog/reference/configuration/) | [`reference/configuration.md`](https://raw.githubusercontent.com/Heiss/muffelblog/main/apps/docs/src/content/docs/reference/configuration.md) | Every setting of the builder and the site, with defaults and limits. | You are unsure about a variable.           |
| [Addresses](/muffelblog/reference/urls/)              | [`reference/urls.md`](https://raw.githubusercontent.com/Heiss/muffelblog/main/apps/docs/src/content/docs/reference/urls.md)                   | Every address of a running blog and what it shows.                   | Finding where something lives on the blog. |
| [Supported versions](/muffelblog/reference/versions/) | [`reference/versions.md`](https://raw.githubusercontent.com/Heiss/muffelblog/main/apps/docs/src/content/docs/reference/versions.md)           | The tested versions of Memos and Nextcloud.                          | Checking compatibility.                    |
| [Architecture](/muffelblog/reference/architecture/)   | [`reference/architecture.md`](https://raw.githubusercontent.com/Heiss/muffelblog/main/apps/docs/src/content/docs/reference/architecture.md)   | Services, volumes, how a release is built and switched.              | Understanding or debugging the pipeline.   |

## The running blog

Where things are on a blog that is online. The full list is in
[Addresses](/muffelblog/reference/urls/).

| Address                                | What you find                                                                                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                    | The feed: posts, memos and terms, newest first. Filters _Alle_, _Lang_, _Kurz_, _Begriffe_ and a sort switch _Erstellt_ / _Aktualisiert_ below them |
| `/posts/`, `/memos/`, `/terms/`        | The feed filtered by kind; sorted by last edit under `/updated/`, `/posts/updated/` and so on                                                       |
| `/p/<slug>/`, `/m/<id>/`, `/g/<slug>/` | One post, memo or term, with links to and from it and a small graph                                                                                 |
| `/glossary/`                           | All terms by letter                                                                                                                                 |
| `/tag/`, `/tag/<tag>/`                 | Tag overview and the entries of one tag                                                                                                             |
| `/search/`                             | Search (needs JavaScript)                                                                                                                           |
| `/comments/`                           | New comments of the whole site as one list, newest first; replies name what they answer; each entry links to its comment on its page                |
| `/graph/`                              | The link graph; the mouse wheel zooms, dragging moves it                                                                                            |
| `/files/`                              | The published files as they lie in the Nextcloud folder                                                                                             |
| `/<slug>/`                             | A static page (`type: page`); with `nav: true` it is in the header menu "More", otherwise in the footer                                             |
| `/feed.xml`, `/sitemap.xml`            | RSS and sitemap, only when `SITE_URL` is set                                                                                                        |
| `/health.json`, `/build.json`          | State of the builder and the release that is online                                                                                                 |

## Writing a note

A file in the Nextcloud folder is published only with `publish: true`. Fields,
kinds and rules are in [Writing posts, terms and pages](/muffelblog/guides/writing/).
