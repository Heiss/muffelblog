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

# Implementation (W23)

* **[E]** `MUFFEL_LANG` defaults to `en` (decided by the owner, 2026-11-04). An
  unknown value stops the build (fail closed, like the numeric settings in
  [Configuration](/ops/config.md)). The value is read case-insensitively; an
  empty value counts as unset. A German blog sets `MUFFEL_LANG=de`.
* **[E]** UI strings live in one message catalog per language
  (`apps/site/src/i18n/de.ts`, `en.ts`). The English catalog defines the shape,
  `types.ts` derives the type `Messages` from it, so a key that is missing in
  German fails the type check. A test compares keys and the arity of the
  functions of both languages.
* **[E]** The language is a build-time constant: `astro.config.mjs` puts
  `MUFFEL_LANG` in as `__MUFFEL_LANG__` (Vite `define`), so the scripts that
  run in the browser carry exactly one language.
* **[E]** Locale of dates and numbers: `en-GB` for `en` (24 hour clock, "2 Nov
  2026, 14:32"), `de-DE` for `de`. All dates stay in Berlin time.
* **[E]** `<html lang>`, the RSS `<language>`, the search page and its texts and
  the locale of the comments widget follow `MUFFEL_LANG` (decided: feeds and
  search follow the build language).
* **[E]** Texts that the core generates into the HTML (memo title, PDF size,
  embed placeholder, missing image) are kept per language in the core
  (`memos.ts`, `render.ts`), because the core cannot reach the catalog of the
  site. The option is `lang` of `buildMemoEntries` and `renderMarkdown`.
* **[E]** The names of the themes are brand names; only `Hell`/`Light` is
  translated (`theme.names` in the catalog). Theme ids do not change.
* **[E]** Tests: the whole E2E suite runs against the English build and reads
  its texts from the catalog (`ui` in `e2e/helpers.ts`). A small suite
  (`e2e/language-de.spec.ts`) runs against a German build (`pnpm build:de`,
  folder `dist-de`).
* **[E]** The sort order of the glossary does not depend on the UI language,
  because the content is not translated.
* **[E]** Build and server log messages are developer-facing and are English.

# Open

* **[V]** A per-article `lang` in the frontmatter that overrides `<html lang>`
  for one article. Not part of W23 (decided: not now).
* **[U]** Which names of existing files and fixtures are translated: German
  fixture file names are part of tests (for example the umlaut and duplicate
  cases) and stay unless a test needs a change.
