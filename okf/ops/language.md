---
type: Policy
title: Languages
description: Development language, UI language per environment variable, and the order of the translation work.
tags: [language, i18n, translation, conventions]
status: draft
generated: { by: claude-code/web, at: 2026-11-03T14:00:00Z }
---

# Decisions

* **[E]** Development is in English: code identifiers, comments, test names,
  commit messages, pull requests, issues, the README and the OKF bundle. The
  aim is that others can follow and join the work (2026-11-03).
* **[E]** The published site language is a deployment setting. The environment
  variable `MUFFEL_LANG` selects the UI language at build time. Supported
  values: `de` (German) and `en` (English). One build has exactly one UI
  language.
* **[E]** There is no per-language URL prefix (`/de/`, `/en/`) and no language
  detection from the browser. Someone who wants both languages runs two
  instances and links them with the reverse proxy.
* **[E]** Articles, memos and glossary entries are not translated. They appear
  as written.
* **[E]** URLs are English and independent of the UI language: `/page/N/`,
  `/memos/`, `/posts/`, `/tag/<tag>/`, `/glossary/` (A to Z), `/terms/` (series
  for the Terms filter), `/search/`, `/p/<slug>/`, `/m/<uid>/`, `/g/<slug>/`.
* **[E]** The German route names changed with W22c: `/seite/N/` became
  `/page/N/` (also under `/memos/`, `/posts/` and `/tag/<tag>/`). The whole OKF
  bundle was translated in W22d.
* **[E]** No history rewrite: existing German commit messages stay. Everything
  new is English, and the existing text is translated through normal pull
  requests. A force push is limited to the author's own unmerged feature
  branches (`--force-with-lease`), never `main`.
* **[E]** Translation comes before further features, split into several pull
  requests (see W22).

# Proposal

* **[V]** `MUFFEL_LANG` defaults to `de` because the blog is German. An unknown
  value stops the build (fail closed, like the numeric settings in
  [Configuration](/ops/config.md)).
* **[V]** UI strings live in one message catalog per language
  (`apps/site/src/i18n/de.ts`, `en.ts`) with a shared type, so a missing key in
  one language fails the type check. Dates and numbers use the locale of the
  chosen language (`Intl`).
* **[V]** `<html lang>` follows `MUFFEL_LANG`. A per-article `lang` in the
  frontmatter may override it for a single article.
* **[V]** Build and server log messages are developer-facing and are English.

# Open

* **[U]** The default of `MUFFEL_LANG` (proposal: `de`).
* **[U]** Whether feeds (RSS) and search (Pagefind) need the UI language
  (feed title, search placeholder): they follow the build language.
* **[U]** Which names of existing files and fixtures are translated: German
  fixture file names are part of tests (for example the umlaut and duplicate
  cases) and stay unless a test needs a change.
