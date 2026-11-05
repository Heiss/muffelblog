# Update log

## 2026-11-05
* **Update**: Coverage gate (W18): unit tests must cover at least 90 % of the lines and 85 % of the branches, CI blocks below, see [Test strategy](/ops/testing.md).
* **Update**: Security gates (W18, owner): gitleaks, pnpm audit, CodeQL and Trivy in the CI, all blocking, see [Test strategy](/ops/testing.md).
* **Update**: Code quality gates (W18, strict): ESLint complexity, cognitive complexity, nesting and function length block; all existing places rebuilt, see [Test strategy](/ops/testing.md).
* **Update**: W20 and W21: links between files of the folder lead to their pages, "Links of this page" with backlinks, link graph with posts, terms, memos and one node per external domain, local graph per page and `/graph/`; demo content links its posts and terms.
* **Update**: W14 receiving webmentions: webmention.io API read by the builder, mentions as Remark42 comments of the administrator, deletions follow, state recovery from Remark42 (O3); stand-in of webmention.io for demo and CI (`docker/webmention-io-standin.mjs`, flow test); `rel=me` from `MUFFEL_REL_ME`; off by default.
* **Update**: File tree `/files/` (owner's wish): published files in the folders of the Nextcloud folder, without drafts, see [URLs and SEO](/frontend/urls-seo.md).
* **Update**: Social preview images (O17): one PNG per post, memo and term at build time (`satori`, `sharp`), `og:image` only with `SITE_URL`.
* **Update**: Statistics (O19, changed by the owner): no own counter; optional Matomo through `MATOMO_URL` and `MATOMO_SITE_ID`, without cookies, off by default; the CSP names exactly that address.
* **Update**: Supported versions (O8): `supported-versions.json` (Memos 26.11.0 and 26.10.0, Nextcloud 35.0.2 and 34.0.5), contract tests as a matrix of both lines, Renovate raises the current line, docs page reference/versions with a sync test.
* **Update**: Glossary field `term:` (title may be a question, letter view sorts by the term) and comments on terms (O38).
* **Update**: Decisions of the owner on the open points: W14 before the release with a webmention.io stand-in; pinned versions with parallel contract tests (current and previous) and Renovate; per-page social preview images; view counter from the Caddy log (public, on by default, `MUFFEL_STATS`); glossary field `term:` and comments on terms; favicon accepted; O27 reading confirmed; repo public; Renovate details after the release.
* **Update**: OKF aligned before the release: [Open points](/open-points.md) split into open decisions of the owner (with proposals), owner tasks for the go-live, settled points and unverified facts; `docker.md` (builder not root, scheduler in 26.11.0), overview (license, setup, webmention state), W14 state, favicon in URLs and SEO.
* **Update**: Simple setup (decided by the owner): `compose.yaml` alone is production behind the operator's reverse proxy, which only forwards to `127.0.0.1:8080/8081`; Caddy stays; `compose.demo.yaml` + `docker/init-env.sh --demo` for the demo; `compose.host-folder.yaml` as the advanced variant; `compose.domain.yaml` and the tutorial removed; docs: Getting started with the required variables, reverse proxy examples, full configuration table. See [Docker operation](/architecture/docker.md).
* **Update**: HEIC photos (O36 decided): `heif-convert` in the builder image, content check, limits, converter used for articles and memos; `heic-check.ts` runs in the Compose job; HSTS recorded as the proxy's job (owner's decision).
* **Update**: W07 banner "N new entries": `entries.json` (newest 20 entries, built with the site), polling of `build.json` every 60 s while the tab is visible, count by series and tag, click shows the top; E2E tests with a controlled clock.
* **Update**: The builder runs as the user `node` (uid 1000) instead of root (decided by the owner): data folders owned by it, a start check with repair instructions for old volumes, the host folder of the own-proxy setup needs `chown 1000:1000`; CI checks the user and the write access.
* **Update**: MIT license (`LICENSE`, holder "Muffelblog contributors", decided by the owner); favicon (SVG, a white M on blue) and touch icon, chosen by Claude and open to the owner's review.
* **Update**: Hardening and runbook (W16): security review recorded, ports of the demo listen on `127.0.0.1` by default (`MUFFEL_BIND`), the webmention sender resets quietly when the domain changes, runbook for disruptions in the docs, three `[U]` points settled.

## 2026-11-04
* **Update**: Guide for AI agents: the page `start/agent-install` with a short prompt and `agent.md` (served at `/muffelblog/agent.md`) with the rules (secrets stay out of the chat, `.env` is never read back, explicit yes before anything with effect outside), the pages to fetch and the steps with the questions to ask. A docs test keeps its pages, scripts, Compose files and variables in line with the repository.
* **Update**: `/health.json`: the builder writes a public copy of the status (state, lastCheck, lastSuccess, checkIntervalSeconds, failingSince, generatedAt; no error text) into the release that is online at every check, for external monitoring; a static file cannot answer 503, so the monitor reads the content and the age of `lastCheck` (example with `jq` in the operations guide). The Caddyfile and the proxy examples revalidate it; the smoke test checks it.
* **Update**: Tutorial on the documentation site (4 chapters, English): prepare Nextcloud and Memos, set up and publish with `compose.yaml` + `compose.production.yaml` and an own reverse proxy, comments and moderation, webmentions. Decisions of the owner: real setup with domain, 4 larger chapters, legal text templates stay in the example folder (the tutorial links to GitHub), webmention.rocks as the receiver for the outgoing test. The steps inside Nextcloud, Memos, mail provider and webmention.rocks are marked as not checked against a live instance (webmention.rocks could not be reached from the build environment). A test keeps scripts, files and variables of the tutorial in line with the code.
* **Update**: Example Nextcloud folder `examples/nextcloud-folder/` (English): first post with image, glossary entry, legal notice and privacy policy as templates with marked placeholders; a test keeps it loadable without warnings and the legal pages free of real data.
* **Update**: W15 sending webmentions: off by default (`MUFFEL_WEBMENTIONS_SEND`), own module with address checks, endpoint discovery, state with baseline at the first start, retries, host memory, alert for given-up pairs; `docker/webmentions.sh`; guide in the docs; O11 and O12 decided.
* **Update**: W23 UI language: `MUFFEL_LANG` (`en` default, `de`), catalogs per language with a shared type, texts of the core per language, German build for a small E2E suite; new policy [Defaults stay inside](/ops/defaults.md) (webmention sending off by default); restore only works into an empty Remark42 (documented).
* **Update**: Moderation (administrator by email, mail on new comments, `docker/moderate.sh`), `TRUSTED_PROXY` and `X-Real-IP` handling, backup and restore (`docker/backup.sh`, `docker/restore.sh`), all with CI flows; docs updated.
* **Update**: Documentation site added (`apps/docs`, Starlight, English): start, guides, production (own proxy with Caddy/nginx/Traefik examples, own Caddy with domain, operations), reference; Pages workflow; sync tests against the code.
* **Update**: Production variants added: `compose.production.yaml` (own reverse proxy, shared mount) and `compose.domain.yaml` (own Caddy with domain); health check on an internal port.
* **Update**: W13 static copy of the comments done: sanitized tree in the HTML, steps aside for the widget, Remark42 changes trigger builds; contract test and comment-flow test in CI.
* **Update**: W12 done: permanent builder with scheduler (check every 180 s, debounce 1 check, markers for Nextcloud and Memos, state, status file, optional webhook); O18 decided; compose waits for the first release.
* **Update**: W02 done: Nextcloud sync with rclone over the public share, fingerprint change detection, checked download, empty list refused; contract test against a real Nextcloud in CI. Scope decision: Nextcloud, Memos, scheduler and comment copy move into 26.11.0; docs site (Starlight, English, github.io) with production setup (override and own-Caddy example) is added.

## 2026-11-03
* **Update**: Release workflow added: tag `YY.M.MICRO` runs the full CI, then publishes the builder image to GHCR (O10 decided: GHCR) and creates the GitHub release; dry run by hand.
* **Update**: W13 widget part done: Remark42 comments on posts and memos from the own comments host, CSP extended by exactly that origin, `COMMENTS_URL`; static copy follows with the scheduler.
* **Update**: W11 done and the release part of W12: `compose.yaml` (builder, Caddy, Remark42, Mailpit), `docker/Caddyfile` with strict CSP, atomic release swap, CI job "Compose stack".
* **Update**: W10 done: static pages (`type: page`), footer, 404, `robots.txt`, Open Graph tags, `h-entry`/`h-card`; O11 partly, O17 partly, O24 closed, O15 structure done (text open).
* **Update**: W09 done: `/feed.xml` (RSS 2.0) with full text for posts and memos, terms as short definition, stable GUIDs, `MUFFEL_RSS_ITEMS`; only with `SITE_URL`.
* **Update**: W08 done: Pagefind index over posts, memos and terms, own search UI on `/search/` (Modular UI is English only), filters kind and tag.
* **Update**: W19 done: `type: glossary` kind, `/g/<slug>/`, `/glossary/` letter view, `/terms/` series with the Begriffe filter, slugs unique per type; see [Glossary and knowledge graph](/features/glossary.md).
* **Update**: Demo set added (`MUFFEL_FIXTURES=demo`): 9 articles, 9 memos, 15 glossary terms on IT, photography and timber construction with generated placeholder images; README images retaken, see [Test strategy](/ops/testing.md).
* **Update**: W22d done: the whole OKF bundle is translated to English (see [Languages](/ops/language.md)).
* **Update**: W22c done: `apps/site` translated, routes `/page/N/`, UI texts collected in `apps/site/src/i18n/messages.ts`, English CSS classes, English CI job names.
* **Update**: W22b done: `packages/core` translated to English (identifiers, comments, test names, warning messages); UI texts in core collected in `UI` objects.
* **Creation**: [Languages](/ops/language.md): development in English, UI language per `MUFFEL_LANG`, English URLs; roadmap W22 and W23, O39.
* **Update**: Filter renamed: Kurz (memos), Lang (blog posts), Begriffe (glossary terms, kept apart from Lang, marked in All); glossary field `type: glossary`, see [Feed](/frontend/feed.md) and [Glossary](/features/glossary.md).
* **Update**: W06c implemented (branch `feature/w06c-themes`): base layout, ten themes with self-hosted fonts, switcher, no flash, syntax colors per theme; O35 decided, see [Themes](/frontend/themes.md).
* **Creation**: [Glossary and knowledge graph](/features/glossary.md) created (model newworkglossar.de, home page evaluated); work packages W19 to W21, open point O38.
* **Update**: Split view dropped (W06b is gone), unified with a filter stays, non-goal "no graph" replaced, see [Feed](/frontend/feed.md).
* **Update**: W06 split into three pull requests (W06a endless scroll, filter, going back; W06b split view; W06c themes); decisions on split data, mode change and dark system setting recorded.
* **Update**: Work package W18 (code quality, complexity, mutation tests from 80 %) and O37 added, deliberately not at the start.
* **Creation**: [Configuration](/ops/config.md) created: numeric values for feed and memos as environment variables `MUFFEL_<AREA>_<NAME>`, invalid values stop the build.
* **Update**: W05 implemented (branch `feature/w05-feed-statisch`): combined feed with blocks of 20, series `/`, `/memos/`, `/posts/`, tag overview and tag lists, sitemap and canonical only with `SITE_URL`; decisions on O1, O13, O20 recorded, see [Feed](/frontend/feed.md).
* **Update**: Merge rule recorded: the assistant merges its own pull requests after a green CI, see [Branching and release](/ops/branching-release.md).

## 2026-11-02
* **Update**: W04 implemented (branch `feature/w04-memos`): Memos source, pages `/m/<uid>/`, mirroring attachments, contract test with a CI job; decisions O6, O14 and the tag rule recorded, see [Memos](/content/memos-source.md).
* **Update**: Themes: all ten stay, the default is Solarized Light (O35), see [Themes](/frontend/themes.md).
* **Update**: W03 implemented (branch `feature/w03-rendering`): Markdown rendering with sanitizing, remote images and embeds only from allowlists, local images as WebP without EXIF; decisions O5 and O7 recorded, see [Media](/content/media.md).
* **Creation**: [Themes](/frontend/themes.md) created: several color schemes in the style of well-known editor themes (O35), preview with ten themes.
* **Update**: W01 implemented (branch `feature/w01-frontmatter`): article loader, frontmatter schema, slugs, date, tags, pages `/p/<slug>/`; decisions O2, O13 (partly), O21, O26 recorded, see [Frontmatter](/content/frontmatter.md).
* **Update**: Renovate runs. Auto-merge stays limited to patch, TypeScript is held at version 6 (O31), see [Branching and release](/ops/branching-release.md).
* **Update**: First CI run of W00 on GitHub green (Docker build, lint/types/unit/build, E2E, gate); roadmap criteria updated.
* **Update**: W00 implemented (branch `feature/w00-fundament`): workspace, Astro scaffold, Vitest, Playwright, ESLint, Prettier, Dockerfile, CI with a gate job, Renovate configuration; findings and open acceptance points in the [roadmap](/roadmap.md).
* **Update**: [Test strategy](/ops/testing.md): Vitest and Playwright, full suite on every PR and again on the tag, pinned test instances, gate job for documentation PRs.
* **Creation**: [Test strategy](/ops/testing.md) created (TDD with mocks, E2E tests, contract tests); roadmap criteria added.
* **Update**: Renovate (GitHub app) with auto-merge for patch updates, 3 days of waiting, decided without exceptions (O31); W00 extended by Renovate criteria.
* **Update**: Release tags changed from `vX.Y.Z` to CalVer `YY.M.MICRO` without `v` (SemVer-valid), auto-updater rules added, see [Branching and release](/ops/branching-release.md).
* **Creation**: [Branching and release](/ops/branching-release.md) created: GitHub Flow, squash merge, tags `vX.Y.Z`, images only on a tag.
* **Update**: Decisions on W00 recorded: base branch `main`, pnpm on Node LTS, GitHub Actions, hybrid test strategy.
* **Creation**: [Roadmap](/roadmap.md) with work packages, dependencies and definition of done created.
* **Creation**: Bundle from the brainstorming session created, see [Overview](/overview.md).
* **Review**: Critical review, result in [Open points](/open-points.md).
