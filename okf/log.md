# Update log

## 2026-11-03
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
