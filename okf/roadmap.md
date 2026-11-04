---
type: Roadmap
title: Roadmap and definition of done
description: Work packages with dependencies, decisions needed and acceptance criteria for the step-by-step build on feature branches.
tags: [roadmap, planning, definition-of-done]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T13:10:00Z }
---

# Approach

* **[E]** The system is built step by step on feature branches.
* **[E]** The user makes decisions along the way. For every decision 3 to 5
  options are presented. The options come at the start of the respective work
  package, not in advance.
* **[E]** The system goes live when all work packages are done (W17).
* **[E]** A work package corresponds to one feature branch and one pull request
  against `main`. Branching model, merge method and release are in
  [Branching and release](/ops/branching-release.md). The naming convention
  `feature/wNN-<short name>` is a proposal **[V]**.
* **[V]** The order follows a "walking skeleton": first one continuous thin path
  (articles from files to the page), then memos, then client, then operation and
  community.

# Global definition of done

Applies to every work package in addition to its own criteria:

* [ ] All acceptance criteria of the package are met and ticked off in the pull
  request.
* [ ] The CI is green: lint, type check, unit, E2E and contract tests,
  `astro build`. The full suite runs on every pull request.
* [ ] The tests came first (TDD) and cover the new logic, also error cases
  (broken input, failure of a source). Packages with a UI have E2E tests. See
  [Test strategy](/ops/testing.md).
* [ ] There are no secrets in the repo (secret scan without findings).
* [ ] The browser loads no foreign resources (network or CSP test).
* [ ] The decisions of the package are recorded with options and choice in the
  OKF bundle, `[U]` points are checked and set to `[E]` or `[V]`, `log.md` and
  `open-points.md` are updated.
* [ ] The user has accepted the pull request.

# Dependencies

| Package | Topic | Depends on | In parallel with |
|---|---|---|---|
| W00 | Foundation | - | - |
| W01 | Article model and frontmatter | W00 | W11 |
| W02 | Nextcloud sync | W00 | W01, W03 |
| W03 | Rendering, sanitizing, article images | W01 | W02 |
| W04 | Memos source and image mirroring | W03 | W11 |
| W05 | Static feed, blocks, tags, sitemap | W01, W04 | W11 |
| W06a | Feed client: endless scroll, filter, going back | W05 | W08, W09, W10, W11 |
| W06c | Layout and themes | W06a | W08, W09, W10, W11 |
| W07 | build.json and banner | W05, W06a | W08, W09, W10 |
| W08 | Search (Pagefind) | W05 | W06, W09, W10 |
| W09 | RSS | W05 | W06, W08, W10 |
| W10 | SEO, microformats, static pages | W05 | W06, W08, W09 |
| W11 | Docker scaffold | W00 | W01 to W10 |
| W12 | Build pipeline and scheduler | W02, W04, W11 | W06 to W10 |
| W13 | Comments (Remark42) | W05, W11, W12 | W07 to W10 |
| W14 | Webmentions receiving and display | W13, W10; **domain** | - |
| W15 | Webmentions sending | W14 | - |
| W16 | Hardening and operation | W12, W13, W14, W15 | - |
| W17 | Go-live | all | - |
| W18 | Code quality, complexity, mutation tests | W05; extend later | W06c to W16 |
| W19 | Glossary: kind of content, `/g/`, letter view, feed filter | W05, W06a | W07 to W11 |
| W20 | Linking and backlinks | W03, W19 | W07 to W11 |
| W21 | Knowledge graph | W20 | W07 to W11 |
| W22 | English as development language (translation in several PRs) | - | - |
| W23 | UI language per `MUFFEL_LANG` (de, en) | W22 | W07 to W11 |

**Critical path:** W00, W01, W03, W04, W05, W12, W13, W14, W15, W16, W17.

**External blockers**
* **Domain:** needed at the latest before W14 (`rel=me`, IndieAuth, webmention
  targets, absolute URLs). Before that a test domain is enough (O9, O29).
* **Test instances:** W02, W04, W13 and W14 need Nextcloud, Memos, Remark42 and a
  mail sink as a test environment or mocks (O29).

# Work packages

## W00 - Foundation

* Branch: `feature/w00-fundament`
* Depends on: -
* Decided:
  * **[E]** The base branch is `main`, created from the state of specification
    and roadmap. Feature branches branch off `main`, pull requests go against
    `main` (O28).
  * **[E]** pnpm on Node 26 (LTS line "Lithium" according to the release list of
    2026-11-02).
  * **[E]** pnpm workspace with `apps/site` (Astro), `apps/builder` (scheduler,
    sync, mention jobs) and `packages/core` (shared code).
  * **[E]** ESLint and Prettier.
  * **[E]** CI with GitHub Actions.
  * **[E]** Test strategy (O29): TDD with mocks, E2E tests and contract tests
    against real, pinned test instances (Nextcloud, Memos, Remark42, Mailpit).
    Vitest for unit tests, Playwright for E2E tests.
  * **[E]** The full suite runs on every PR, a gate job with path detection
    handles pure documentation PRs (see [Test strategy](/ops/testing.md)).
  * **[E]** Renovate (GitHub app) with auto-merge for patch updates and 3 days of
    waiting, see [Branching and release](/ops/branching-release.md).
* Still open: registry for Docker images (O10), grouping and schedule of
  Renovate (O31), development workflow (O23), branch protection option "branch
  must be up to date" (O33), visibility of the repo (O34).
* Scope: Astro project with TypeScript, lint, format, test runner, CI,
  Dockerfile for the build, sample content (fixtures).
* Findings during implementation:
  * Astro 7 requires Node 22.23.4 or newer. `astro check` does not support
    TypeScript 7, so TypeScript is pinned to `~6.0.3`.
  * `astro preview` starts itself in the background without a terminal and is not
    suitable as a Playwright `webServer`. The E2E tests serve `dist/` with
    `sirv-cli`.
  * Corepack has not been part of Node since version 25. The Dockerfile installs
    pnpm through npm in the version from `package.json`.
  * The image `node:26-slim` exists and the Dockerfile builds: the job "Docker
    build of the site" ran successfully in the first CI run on GitHub (run
    41472880143). In the development environment this could not be checked
    because of a missing Docker daemon.
  * The actions (`actions/checkout@v4`, `pnpm/action-setup@v4`,
    `actions/setup-node@v4`) run. Whether newer major versions exist has not been
    checked. Renovate raises them.
* DoD (state of implementation):
  * [x] `docker build` creates the Astro project reproducibly. The job "Docker
    build of the site" ran successfully on GitHub and checks that
    `out/index.html` exists.
  * [x] CI runs lint, type check, unit tests (Vitest), E2E tests (Playwright)
    and build, and one sample test runs per kind of test. The first run on
    GitHub was green (5 unit tests, 2 E2E tests).
  * [x] A gate job with path detection is the required check for `main`. The code
    path (full suite) ran green on GitHub. The documentation path (heavy jobs
    skipped, gate green) was confirmed on GitHub with the pull request of W22a.
  * [x] README with start and test instructions.
  * [ ] The CI is entered as a required check for `main` (a setting by the user,
    name of the check: "CI Gate").
  * [x] `renovate.json` is configured (patch auto-merge, 3 days of waiting), the
    Renovate app is installed and running (see O31).

## W01 - Article model and frontmatter

* Branch: `feature/w01-frontmatter`
* Depends on: W00
* Decided (see [Frontmatter](/content/frontmatter.md)):
  * **[E]** Date (O2): a plain date counts as 12:00 Berlin time, a time without a
    zone as Berlin local time.
  * **[E]** Duplicate slugs (O26): suffix `-2`, `-3`, the older article keeps the
    slug.
  * **[E]** Tags (O13): lowercased throughout, also in the display.
  * **[E]** Withdrawn articles (O21): simply gone, 404.
* Scope: loader for a local Markdown folder, schema according to
  [Frontmatter](/content/frontmatter.md), slug with transliteration, fallbacks,
  exclusions (see [Nextcloud source](/content/nextcloud-source.md)). The article
  text is not rendered yet, that follows in W03. The pages `/p/<slug>/` show
  title, date and tags.
* DoD (state of implementation, proven locally with Node 26; the CI run is
  pending):
  * [x] `publish` counts only as the boolean `true` (unit tests with `"true"`,
    `yes`, `1`, `false`, `null`).
  * [x] A missing or invalid `date` falls back to the modification date and
    warns.
  * [x] A broken file skips only itself and is logged.
  * [x] Duplicate slugs behave according to the chosen rule.
  * [x] Fixtures cover: valid, invalid YAML, conflict copy, wikilink, umlaut
    slug (also subfolder, hidden directory, time with and without a zone,
    duplicate slug).
  * [x] The build creates `/p/<slug>/` for the fixtures. 14 E2E tests check the
    generated pages and that unpublished articles give 404 (the test demonstrably
    fails if an article is published wrongly).
* Findings during implementation:
  * Chromium reports an empty 404 response on `page.goto` as a network error. The
    check for 404 therefore uses direct HTTP requests.
  * The check for wikilinks ignores code blocks and inline code.
  * The patterns for Nextcloud conflict copies remain unchecked (O25, W02).

## W02 - Nextcloud sync

* Branch: `feature/w02-nextcloud-sync`
* Depends on: W00
* Decisions: sync tool, behavior on partial failure, handling of deleted files,
  checking the unverified facts (O25).
* Scope: fetching the public share through WebDAV with token and password into
  the cache, change detection.
* Done 2026-11-03, see [Nextcloud source](/content/nextcloud-source.md). The
  contract test runs in CI (not possible in the development session).
* DoD:
  * [x] The sync is tested with mocks, a contract test against a real Nextcloud
    test instance exists.
  * [x] The password comes only from a secret.
  * [x] Without a change no build is triggered (the sync reports `changed: false`; the scheduler that acts on it is W12).
  * [x] If fetching fails, the cache stays unchanged.
  * [x] The behavior of `getlastmodified` is documented.

## W03 - Rendering, sanitizing, article images

* Branch: `feature/w03-rendering`
* Depends on: W01
* Decided (see [Media](/content/media.md)):
  * **[E]** Foreign content in articles (O5) is allowed, but only from allowlists:
    images from `upload.wikimedia.org`, `raw.githubusercontent.com` and
    `user-images.githubusercontent.com`, embeds only from
    `www.youtube-nocookie.com` and only after a click. Memos stay strict (images
    mirrored).
  * **[E]** Local article images (O7): scale down, WebP, remove EXIF.
* Scope: Markdown pipeline with an HTML allowlist, relative images from the
  Nextcloud folder, detection of wikilink syntax (see
  [Sanitizing](/security/sanitization.md), [Media](/content/media.md)).
* DoD (state of implementation, proven locally with Node 26; the CI run is
  pending):
  * [x] Raw HTML and scripts in the Markdown do not appear in the output. Unit
    tests check scripts, event attributes, dangerous links, forms, styles, SVG,
    objects and comments. If sanitizing is switched off, five tests fail. An E2E
    test checks in the browser that nothing is executed and nothing is loaded
    from foreign servers.
  * [x] Only referenced images reach the build. The resolver creates files only
    for images that a published article uses.
  * [x] Missing images warn but do not abort (placeholder with alt text).
  * [x] Wikilinks lead to a warning instead of broken HTML (from W01).
  * [x] Remote images and embeds only from allowed hosts, look-alike hosts,
    `http`, credentials and foreign ports are rejected.
  * [x] Local images: WebP in several widths up to 1920 px, EXIF and color
    profile removed, orientation applied, paths outside the folder, hidden
    folders, SVG and links (symlinks) out of the folder are rejected.
* Findings during implementation:
  * `astro build` does not include `sharp` as a native module. The package must
    therefore also be a dependency in `apps/site`.
  * Rendering Markdown with `<script>`, `<style>` and the like removes their
    content as well (`strip` in sanitizing), otherwise the code would stay as
    text.
  * Depending on the setting, Obsidian writes paths relative to the note or from
    the folder root. The resolver tries both ways.

## W04 - Memos source and image mirroring

* Branch: `feature/w04-memos`
* Depends on: W03
* Decided (see [Memos](/content/memos-source.md)):
  * **[E]** The title is always built from date and time.
  * **[E]** PDF, audio and video are mirrored with a size limit (O6).
  * **[E]** Alt text from the file name, `#a/b` stays one tag.
  * Memo date (O14): `createTime`, because the API has no `displayTime`.
* Scope: content loader for public memos, pages `/m/<uid>/`, title and
  description, tags, mirroring attachments (images as WebP without EXIF; PDF,
  audio, video with file signature and size limit), strict render mode (see
  [Memos](/content/memos-source.md), [Media](/content/media.md)).
* DoD (state of implementation): proven locally with Node 26. The contract test
  runs only in the CI, because no Docker daemon is available here.
  * [x] Only `PUBLIC` memos appear (in addition to the filter of the API the
    visibility of every entry is checked; tests with PRIVATE and PROTECTED).
  * [x] No link and no resource points to the Memos instance (unit tests, E2E and
    contract test check the HTML).
  * [x] Mirrored images have no EXIF/GPS data (same processing as for article
    images).
  * [x] SVG, HTML, files that are too large and files whose content does not
    match the extension are rejected; redirects are not followed.
  * [ ] Internal IP targets are rejected. The base address is configuration of
    the operator and redirects are blocked; a general SSRF protection for
    foreign URLs follows with the mention avatars (W14).
  * [x] A fetch error does not make existing memos disappear: the build stops,
    the last good version stays online.
  * [x] Test with sample responses in the shape of the API (fixtures and imitated
    responses).
  * [x] A contract test against a real Memos test instance exists
    (`neosmemo/memos:26.11.0` as a service container, 5 tests, green in the CI).
    It showed that Memos also returns the tag `a` for `#a/b`.
* Findings during implementation:
  * Since 26.10.0 Memos has the paths `/api/...` instead of `/api/v1/...`.
  * Anonymous access works only if the access mode of the instance is PUBLIC.
  * The build now explicitly requires `CONTENT_DIR` and `MEMOS_URL`. Sample data
    exists only with `MUFFEL_FIXTURES=1`; the command `pnpm build` in the repo
    root sets that, the real build is `pnpm build:site`.

## W05 - Static feed, blocks, tags, sitemap

* Branch: `feature/w05-feed-statisch`
* Depends on: W01, W04
* Decided:
  * **[E]** Block size 20 entries (O1).
  * **[E]** Excerpt of an article: description, otherwise the start of the text
    (at most 200 characters, cut at a word boundary). Memos appear in full (O20).
  * **[E]** Tag pages: overview `/tag/` and one list per tag `/tag/<tag>/` with
    blocks `/tag/<tag>/page/N/` (O13).
* Scope: home page, technical blocks `/page/N/` in three series (`/`, `/memos/`,
  `/posts/`), `noindex, follow` from page 2, canonical (only with `SITE_URL`),
  tag pages, sitemap (only with `SITE_URL`), see [Feed](/frontend/feed.md) and
  [URLs and SEO](/frontend/urls-seo.md).
* DoD:
  * [x] Posts and memos appear together, purely chronological (unit test and E2E
    across all blocks, without duplicates).
  * [x] `/page/N/` is not in the sitemap. Pagefind comes in W08, there
    `data-pagefind-ignore` for the blocks has to be added.
  * [x] Page 1 has no route of its own: `/page/1/` gives 404, the first page is
    `/`. So the canonical from `/page/1/` to `/` is dropped.
  * [x] Without JavaScript the next link leads through all entries (E2E with
    JavaScript switched off). A `<noscript>` link is unnecessary because the
    links are normal anchors.
  * [x] Pages have `lang="de"`.
* Findings during implementation:
  * The test build uses blocks of 4 entries (`MUFFEL_FEED_PAGE_SIZE=4`, see
    [Configuration](/ops/config.md)), otherwise the 15 sample entries would make
    only one page.
  * Without `SITE_URL` (domain open, O9) there is neither a sitemap nor a
    canonical. With `SITE_URL` both appear, checked locally but not in the CI.
  * Tags whose URL form is the same (`a/b` and `a-b`) share a page.
  * Article pages `/p/<slug>/` and memo pages did not use the new base layout yet
    at that time (navigation was missing there); W06c changed that.

## W06 - Feed client (in two pull requests)

* Decided **[E]**: split into two pull requests W06a (endless scroll, filter,
  going back) and W06c (layout and themes). **W06b (split view) is dropped** at
  the request of the user (2026-11-03): unified with a filter is enough, the
  split view would be additional complexity.
* Decided **[E]**: a change of the filter rebuilds the list and jumps to the top.
  The filter is kept.
* Decided **[E]**: without a stored choice the site takes Solarized Dark with a
  dark system setting, otherwise Solarized Light. A stored choice wins.

### W06a - Endless scroll, filter, going back

* Branch: `feature/w06-feed-client`
* Depends on: W05
* Scope: loading more through an `IntersectionObserver`, filter All / Lang /
  Kurz (renamed on 2026-11-03) in the unified mode, storing the filter,
  restoring blocks and scroll position when going back.
* DoD:
  * [x] Endless scroll loads blocks without duplicates (E2E across all 4 blocks,
    order checked).
  * [x] Without JavaScript the next link and the filter stay normal links.
  * [x] Without usable `localStorage` the defaults apply.
  * [x] Navigating back restores loaded blocks and scroll position.
  * [x] Loading errors show a hint with a normal link as a way out.
  * [x] Only addresses of the own site in the shape of the blocks are loaded
    (unit test for the check).
* Findings during implementation:
  * The filter changes the address through `replaceState` to the series (`/memos/`,
    `/posts/`, `/`). Reloading `/memos/` then shows the same list. On `/` a
    stored filter wins, an explicitly opened series does not. When opening `/`
    with a stored filter, the mixed stream briefly appears before it is replaced.
  * With JavaScript the pager (also "newer entries") is hidden.

### W06c - Layout and themes

* Branch: `feature/w06c-themes`
* Depends on: W06a
* Decided **[E]**:
  * Layout and themes in one pull request, because themes have nothing to color
    without a layout.
  * Self-host fonts per theme (packages `@fontsource/*`, license OFL-1.1, only
    the character set `latin`). Nothing comes from third parties.
  * The switcher is a select field in the header.
  * Code blocks get syntax colors per theme, colored at build time.
* Implementation:
  * Ten themes as blocks with CSS variables in `styles/themes.css`, list and
    rules in `lib/themes.ts`.
  * `/theme-init.js` is a short, blocking script in the `<head>` that sets
    `data-theme` before the first paint. It is generated from the same list, so
    they cannot drift apart.
  * Coloring uses `lowlight` (highlight.js) after sanitizing. The classes
    `hljs-*` come only from the coloring, not from the text. Without a language
    nothing is guessed.
* DoD:
  * [x] All ten themes can be chosen, Solarized Light is the default, with a dark
    system setting Solarized Dark, a stored choice wins.
  * [x] Every theme passes the contrast test (text, muted text, accent, text on
    accent and all six code colors at least 4.5:1), checked in
    `lib/themes.test.ts`.
  * [x] The chosen theme is kept after reloading and on other pages. An E2E test
    blocks all other scripts and checks that `data-theme` is nevertheless
    already set.
  * [x] Without `localStorage` and without JavaScript the default applies, the
    switcher is hidden without JavaScript.
  * [x] Fonts come from the own domain (E2E: no foreign request, Matrix loads
    IBM Plex Mono).
  * [x] At 360 pixels width there is no horizontal scrolling.
  * [x] The README images are retaken with the new look (`pnpm screenshots`, PR
    #19, only after W06c at the request of the user).
* Findings during implementation:
  * Author styles with `display` override the attribute `hidden`. A global rule
    `[hidden] { display: none !important }` is needed, otherwise the pager and
    the switcher would stay visible without JavaScript.
  * The packages deliver `woff2` and `woff` per font. Both end up in `dist` (about
    480 KB in total), only the `woff2` of the active theme is loaded.
  * The contrast had to be raised for eight colors, mainly comment and keyword
    colors (for example Gruvbox, Monokai).

## W07 - build.json and banner

* Branch: `feature/w07-build-json`
* Depends on: W05, W06
* Decisions: number of entries in `build.json`, polling interval, design of the
  banner.
* DoD:
  * [ ] `build.json` is written as the last file of a build.
  * [ ] Conditional requests answer with 304.
  * [ ] The banner counts only entries that are newer than the newest loaded
    one.
  * [ ] A click scrolls up and shows the new entries.
  * [ ] The banner does not appear if only comments change.
  * [ ] Polling happens only while the tab is visible.

## W08 - Search (Pagefind)

* Branch: `feature/w08-suche`
* Depends on: W05
* Decided: own UI on the Pagefind JS API (O16), see [Search](/features/search.md).
* DoD:
  * [x] Posts and memos can be found, filter by type and tag.
  * [x] Technical blocks are not in the index, no duplicate hits.
  * [x] Search works without foreign requests.

## W09 - RSS

* Branch: `feature/w09-rss`
* Depends on: W05
* Decisions: scope and excerpt (O20), domain placeholder until it is set.
* DoD:
  * [x] `/feed.xml` is valid and combines posts and memos.
  * [x] GUIDs are stable, independent of date and domain.
  * [x] The feed contains no comments and mentions.

## W10 - SEO, microformats, static pages

* Branch: `feature/w10-seo`
* Depends on: W05
* Decisions: Open Graph (O17), microformats (O11), imprint and privacy policy
  (O15), 404 and `robots.txt` (O24).
* Decided (2026-11-03): static pages (Impressum, Datenschutz, ...) come from
  Nextcloud as files with `type: page` (URL `/<slug>/`, no date, not in feed, RSS,
  tags or search; reserved names are refused); footer on every page lists them;
  404 page and `robots.txt`; Open Graph (`og:*`, `twitter:card=summary`, no
  images); `h-entry` on posts, memos and terms, `h-card` for the site (author
  and `rel=me` follow in W14). The demo set carries clearly marked placeholder
  pages, no legal text is in the repo.
* DoD:
  * [x] Every page has a title, description and canonical.
  * [x] Post and memo pages carry valid `h-entry` markup.
  * [x] Static pages such as the imprint can be published.
  * [x] A 404 page and `robots.txt` exist.

## W11 - Docker scaffold

* Branch: `feature/w11-docker`
* Depends on: W00
* Decisions: reverse proxy (O9), image build (O10), versions (O8).
* Scope: Compose with `web`, `builder`, `remark42` as placeholders, volumes,
  secrets, Caddy rules, health checks (see [Docker](/architecture/docker.md)).
* Done 2026-11-03, see [Docker](/architecture/docker.md). The compose run is
  verified in CI (job "Compose stack"); the session had no usable container
  network, the Caddyfile and the release folder were checked with a real Caddy.
* DoD:
  * [x] `docker compose up` starts all services in a test environment.
  * [x] Secrets come from secrets or `.env`, not from the repo.
  * [x] Delivery uses a symlink to the current release.
  * [x] Caddy rejects basic auth on the Remark42 routes from outside.
  * [x] A CSP without foreign sources is set.

## W12 - Build pipeline and scheduler

* Branch: `feature/w12-pipeline`
* Depends on: W02, W04, W11
* Decisions: debounce time, number of releases kept, reporting channel for errors
  (O18).
* Done 2026-11-04, see [Pipeline](/ops/pipeline.md). The reading of the
  Remark42 and webmention sources is added with W13 (copy) and W14.
* DoD:
  * [x] Every 3 minutes changes are checked, without a change no build.
  * [x] The release swap is atomic, `build.json` comes last.
  * [x] On a fetch error the last good version stays online.
  * [x] Earlier releases are kept for open tabs.
  * [x] A failed build is reported.

## W13 - Comments (Remark42)

* Branch: `feature/w13-kommentare`
* Depends on: W05, W11, W12
* Decisions: host name and path (O9), sorting and display (O4), moderation
  (O22), privacy (O15).
* Done in 26.11.0 (2026-11-03): widget on posts and memos from the own comments
  host (`COMMENTS_URL`, default `:8081` locally; embed script and iframe allowed
  in the CSP for exactly that origin), configured by a bundled script (no inline
  script), login only by email via Mailpit (Migadu by variables), basic auth
  from outside refused (W11). Static sanitized copy and its contract test were added on
  2026-11-04 (see [Comments](/community/comments.md)). Open: backup test.
* DoD:
  * [x] Login only by email, the mail arrives through Migadu (in a test
    environment with a mail sink).
  * [x] The widget loads only from the own host.
  * [x] The static copy of the comments is sanitized and visible without
    JavaScript.
  * [x] Without login no commenting is possible.
  * [x] Comments are possible on posts and memos.
  * [x] The data of Remark42 is backed up (volume, backup test). `docker/backup.sh`
    and `docker/restore.sh`, tested in CI (2026-11-04).
  * [x] A contract test against a real Remark42 test instance exists (the mail
    sink part is covered by the smoke test, a real login mail is not tested).

## W14 - Webmentions: receiving and display

* Branch: `feature/w14-webmentions-empfang`
* Depends on: W13, W10, domain
* Decisions: state and recovery (O3), comment text, checking the webmention.io
  API (O25).
* DoD:
  * [ ] `rel=webmention` and `rel=me` are set.
  * [ ] New mentions appear as a comment in the timeline of the target page.
  * [ ] Mentions are never posted twice, also after losing the state.
  * [ ] The mention text is sanitized as text, no HTML.
  * [ ] Avatar mirroring has SSRF and size protection or is dropped.
  * [ ] If webmention.io fails, existing mentions stay visible.
  * [ ] Posting and deleting mentions as `admin` is secured against the real
    Remark42 test instance in the contract test.

## W15 - Webmentions: sending

* Branch: `feature/w15-webmentions-senden`
* Depends on: W14 on paper; decoupled on 2026-11-04: sending needs only
  `SITE_URL` and the `h-entry` markup, W14 (receiving, needs the domain) follows
  later.
* Decisions **[E]** (2026-11-04): all in [Webmentions](/community/webmentions.md):
  posts, memos and terms send (O12), own module (O11), block list instead of
  allow list, host memory, baseline at the first start, limits, visibility and
  alert. Off by default.
* DoD:
  * [x] Sending happens only after the new build is served (the sender reads
    the release that `current` points at, in the background of the builder).
  * [x] Sent pairs are stored (`state/webmentions.json`), rebuilds do not send
    again; the first start sends nothing.
  * [x] Changes and deletions trigger a new notification.
  * [x] Time limits, size limits, address checks and error handling for foreign
    servers (`safeFetch`, tested with real local servers).
  * [x] Compose job checks that the first start sends nothing
    (`docker/webmention-flow.sh`).
  * [ ] A real receiver on the internet is not tested; the tutorial covers it
    with a local receiver (`docker/webmention-receiver.mjs`).

## W16 - Hardening and operation

* Branch: `feature/w16-haertung`
* Depends on: W12, W13, W14, W15
* Decisions: backup target and rhythm, alert channel (O18), statistics (O19).
* DoD:
  * [ ] Backup and restore of Remark42 and state are tested.
  * [ ] Security review (secrets, SSRF, sanitizing, headers) without open
    findings.
  * [ ] Runbook for disruptions (source not reachable, build broken, domain
    change).
  * [ ] All `[U]` points in the bundle are checked or accepted knowingly.
  * [ ] The tag workflow runs the full suite again and publishes no images if
    it is red.

## W17 - Go-live

* Branch: `feature/w17-golive`
* Depends on: all
* Decisions: domain and DNS (O9), SPF/DKIM/DMARC, handling of old mentions on the
  first run, publishing the first content.
* DoD:
  * [ ] Domain, TLS and DNS are set up, login mails are deliverable.
  * [ ] Imprint and privacy policy are published (O15).
  * [ ] The first real run with the real sources is successful.
  * [ ] All open points in `open-points.md` are decided or postponed knowingly.

## W18 - Code quality, complexity, mutation tests

* Branch: `feature/w18-qualitaet`
* Depends on: W05 (enough code to measure); deliberately not at the start
* Occasion: the user wants static analysis (code quality, complexity) and later
  mutation tests with more than 80 %, so the code fits the TDD tests.
* Decisions (open, O37): tools, thresholds for complexity, whether the analysis
  blocks the CI or only reports, scope and run time of the mutation tests (all
  packages or only `packages/core`), when to introduce the 80 % threshold.
* DoD (draft, **[V]**):
  * [ ] Complexity limits are set in the lint configuration and the CI checks
    them.
  * [ ] A report on code quality exists, existing findings are fixed or accepted
    knowingly.
  * [ ] Mutation tests run for the chosen packages, the mutation score is at
    least 80 %, surviving mutants are assessed.
  * [ ] Run time and CI costs are measured (see O34), the run does not block pull
    requests for an unnecessarily long time.

## W19 - Glossary

* Branch: `feature/w19-glossar`
* Depends on: W05, W06a
* Decided **[E]**: field `type: glossary`, filter and series **Begriffe**
  (`/terms/`), terms also in All, but marked.
* Decisions (O38): term field and question form of the title, sorting of
  umlauts, comments on terms.
* Scope: kind of content `glossary` in the loader, pages `/g/<slug>/`, letter
  view `/glossary/`, third kind in the feed with a filter, inclusion in the
  sitemap (see [Glossary](/features/glossary.md)). Search and RSS follow in W08
  and W09.
* Implemented (2026-11-03): `type: glossary` in the loader (unknown values warn
  and count as posts), slugs unique per type (`/p/` and `/g/` are separate
  namespaces), kind `glossary` in the feed, `/g/<slug>/`, `/glossary/`,
  `/terms/` with `/terms/page/N/`, filter **Begriffe**, terms in the sitemap.
  The title counts as the term; the separate term field and the question form
  stay open (O38). Sorting uses the German collation (`de`, base letters).
* DoD:
  * [x] A file with `type: glossary` and `publish: true` creates `/g/<slug>/`;
    without `type` it stays an article.
  * [x] Terms appear in the feed in chronological order and can be filtered.
  * [x] `/glossary/` groups by letter of the term, umlauts under the base letter,
    the bar consists of real links.
  * [x] Duplicate slugs in the glossary get a counter and do not disturb `/p/`.
  * [x] Everything is reachable without JavaScript.

## W20 - Linking and backlinks

* Branch: `feature/w20-verlinkung`
* Depends on: W03, W19
* Scope: resolving relative Markdown links to published files into pages, a
  warning on dead links, edge list, lists "links to" and "linked from" on article
  and term pages.
* DoD (draft, **[V]**):
  * [ ] A link with a relative file path as its target leads to the page of the
    target, also with `%20` and decomposed umlauts in the path.
  * [ ] Links to unpublished or unknown files become text with a warning, never a
    link.
  * [ ] Backlinks appear as an HTML list, without self-references and
    duplicates.
  * [ ] Memos appear neither as a source nor as a target.

## W21 - Knowledge graph

* Branch: `feature/w21-graph`
* Depends on: W20
* Decisions: threshold for the size of `graph.json`, layout, keyboard operation.
* DoD (draft, **[V]**):
  * [ ] The build writes `graph.json` only with published nodes.
  * [ ] A local graph per page and an overall view `/graph/`, drawn without a
    foreign library and without a request to third parties.
  * [ ] Every node is reachable by keyboard, the backlink lists remain the access
    without JavaScript.

## W22 - English as development language

* Branches: `feature/w22a-rules`, `feature/w22b-core`, `feature/w22c-site`,
  `feature/w22d-okf`
* Depends on: -
* Decided **[E]**: see [Languages](/ops/language.md). Translation first, then
  demo content and W07 onward. No history rewrite.
* Split:
  * **W22a** rules: `AGENTS.md`, README, the language concept, roadmap entry.
    Done.
  * **W22b** `packages/core`: identifiers, comments, test names, log messages.
    Done. Findings: the texts that end up in the pages (memo title "Memo vom
    ...", PDF label, embed placeholder, "[Bild fehlt]") are still German. They
    sit in one `UI` object per file (`render.ts`, `memos.ts`) and move to the
    message catalog in W23. CSS classes in the generated HTML are English now
    (`image-missing`, `memo-attachments`, `attachment`). The fallback file name
    of `safeFileName` is `file`.
  * **W22c** `apps/site`, E2E tests, workflow, scripts, UI strings collected in
    one place (still German). Done. The routes are `/page/N/` now. All UI texts
    of the site live in `apps/site/src/i18n/messages.ts` (German, one object,
    becomes one catalog per language in W23). CSS classes and data attributes
    are English (`entry`, `content`, `excerpt`, `site-header`, `theme-picker`,
    `pager`, `data-feed-list`, `data-series`); the tag list is styled through the
    class `tags`, not through its localized `aria-label`. The CI job names are
    English (the required check `CI Gate` is unchanged). The test files
    `artikel.spec.ts` and `startseite.spec.ts` are `article.spec.ts` and
    `home.spec.ts`. The values stored in the browser for the filter changed from
    `alle` to `all`; an old stored value falls back to `all`.
  * **W22d** the OKF bundle (about 17,000 words), file by file. Done.
* DoD:
  * [x] `AGENTS.md`, README and the language rules are English.
  * [x] No German identifiers, comments or test names remain in `packages/`,
    `apps/`, scripts and workflows. German text remains only where it is content
    or UI text (fixtures, message catalog).
  * [x] The whole OKF bundle is English and `lint_okf` passes.
  * [x] All checks stay green after each part.

## W23 - UI language

* Branch: `feature/w23-ui-language`
* Depends on: W22c
* Decided **[E]**: `MUFFEL_LANG` (`de` or `en`), one language per build, no URL
  prefix, no browser detection, content not translated. Default `en`, feeds and
  search follow the build language, no per-article `lang` for now (2026-11-04).
  Details: [Languages](/ops/language.md).
* DoD:
  * [x] A message catalog per language with a shared type; a missing key fails
    the type check (`types.ts`, test `catalog.test.ts`).
  * [x] `MUFFEL_LANG=en` renders the whole UI in English, `de` in German, an
    unknown value stops the build (`readSettings`, `pickMessages`).
  * [x] `<html lang>`, RSS `<language>`, date and number formats follow the
    language; texts that the core generates (memo title, PDF size, embed
    placeholder, missing image) too.
  * [x] E2E tests cover both languages: the whole suite in English, a small
    suite against a German build.
  * [ ] All CI checks green on the pull request.
