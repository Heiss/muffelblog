---
type: Open Questions
title: Open points from the critical review
description: Prioritized list of unresolved decisions, contradictions and unverified facts.
tags: [open, review, risks]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

The IDs (O1 to O39) are referenced in the other concepts. Every point states what
is entered in the specification today ("entry") and what speaks against it.

# A. Decisions that affect the architecture

| ID | Topic | Entry / problem | Impact |
|---|---|---|---|
| O1 | Block series for the filter | **[E]** Three series of technical blocks (mixed, memos, posts), block size 20, implemented in W05. The split view is dropped. | [Feed](/frontend/feed.md) |
| O2 | Date format and time zone | **[E] decided:** plain date = 12:00 Berlin time, time without a zone = Berlin local time, with a zone the instant counts. | [Frontmatter](/content/frontmatter.md) |
| O3 | State of the mention sync | If the state file is lost, all mentions would be posted twice. Proposal: a marker (source URL) in the comment text, from which the state is restored from Remark42. | [Webmentions](/community/webmentions.md) |
| O5 | Foreign content in Markdown | **[E] decided:** allowed in articles, but only from allowlists. Images: `upload.wikimedia.org`, `raw.githubusercontent.com`, `user-images.githubusercontent.com`. Embeds: `www.youtube-nocookie.com`, only after a click. Memos stay strict (images mirrored). This deviates from the earlier rule "load nothing from other services". Risk: the IP addresses of visitors go to the image hosts (O15). | [Media](/content/media.md) |
| O8 | Versions: "always newest" against pinning | The user wants the newest version for Memos and Nextcloud. An API change can break the build. Remark42, Caddy and Node should be pinned. The contradiction remains for Memos. | [Docker](/architecture/docker.md) |
| O9 | Reverse proxy, domain, Remark42 host | Is a proxy already running on the server (Traefik, nginx)? Caddy is only a proposal. Remark42 needs the public URL, probably a subdomain. Operation under a path is unchecked. The domain is pending. | [Docker](/architecture/docker.md) |
| O10 | Image build | Partial decision **[E]**: CI runs with GitHub Actions. The Dockerfile for the site exists (W00) and builds in the CI (`node:26-slim` exists). Also **[E]**: images are built only on a CalVer tag `YY.M.MICRO` (e.g. `26.11.0`) in CI and put into a registry (see [Branching and release](/ops/branching-release.md)). Open: which registry (proposal GHCR). | [Docker](/architecture/docker.md) |
| O28 | Base branch and branch convention | **[E] decided:** the base is `main`, created from the state of specification and roadmap. The convention `feature/wNN-<short name>` is a proposal **[V]**. | [Roadmap](/roadmap.md) |
| O29 | Test strategy for external services | **[E] decided:** TDD with mocks, E2E tests and contract tests against real, pinned test instances. The full suite runs on every PR and again on the tag. See [Test strategy](/ops/testing.md). Concerns W02, W04, W13, W14. | [Test strategy](/ops/testing.md) |
| O32 | webmention.io test | **[E]** Tools: Vitest and Playwright. Open: is there an additional read test against the real webmention.io service, although it is external and possibly flaky? | [Test strategy](/ops/testing.md) |
| O33 | Branch must be up to date | Branch protection option against semantic conflicts of PRs that are green at the same time. Costs re-basing with many Renovate PRs. Alternative: merge queue. Not decided. | [Test strategy](/ops/testing.md) |
| O34 | Visibility of the repo and CI minutes | Public repos have unlimited minutes, private ones do not. The full suite per PR with four containers uses a lot. Visibility is unclear. | [Test strategy](/ops/testing.md) |
| O30 | Default branch of GitHub | Currently the session branch `ccr-01da7c96-avlx2l`, `main` is wanted. The switch can only be done by the user in the repo settings. | [Branching and release](/ops/branching-release.md) |
| O31 | Auto-updaters | **[E]** Renovate as a GitHub app, pull requests for foreign images and pnpm dependencies, patch updates merged automatically without exception (minor and major by hand, extension to minor postponed), TypeScript held at version 6, 3 days of waiting, no automatic pulling on the server. Open: grouping of the updates, schedule, whether the waiting time really holds with GitHub's auto-merge. Risk: auto-merge presupposes a CI as a required check (only from W00), and a Remark42 patch can contain database changes, so a backup before the next tag. | [Branching and release](/ops/branching-release.md) |
| O27 | Reading of "standalone" | The user wrote "the service should work standalone when something is delivered". Entry: the delivered site runs without Nextcloud, Memos and foreign services. This was not explicitly confirmed. | [System](/architecture/system.md) |

# B. Content and behavior

| ID | Topic | Entry / problem |
|---|---|---|
| O4 | Remark42 display | The default sorting in the widget and the display of the author `admin` are unchecked. The timeline with mentions works only with sorting by time. |
| O6 | Attachments that are not images | **[E] decided:** PDF, audio and video are mirrored with a size limit (25 MB), only for allowed extensions and with a matching file signature. Everything else is skipped (see [Media](/content/media.md)). |
| O7 | Image sizes and formats | **[E] decided:** local article images in several widths (480 to 1920) as WebP, EXIF and color profile removed, SVG rejected. Implemented with `sharp`. |
| O11 | Webmentions: sender and microformats | The implementation of the sender is open. `h-entry`/`h-card`, `rel=me`, IndieAuth were not discussed, but are needed for a useful display. |
| O12 | Sending from memos | The user said "yes, definitely" for sending and "also for memo pages" for mentions. Sending from memos is an assumption. |
| O13 | Tag rules | **[E] partly decided:** tags lowercased throughout, also in the display. Nested Memos tags (`#a/b`) stay one tag **[E]**. Tag pages: overview `/tag/` and a list per tag **[E]** (W05). Open: do inline `#tags` in articles count? A shared namespace for posts and memos is a proposal. |
| O14 | Memo date | **[E] decided:** `createTime` (the API has no `displayTime`). The title is always built from date and time, also for memos with only an image. |
| O20 | Feed display of posts, RSS scope | **[E partly]** Feed excerpt: description, otherwise the start of the text, at most 200 characters (W05). Open: number of RSS entries, full text or excerpt in the RSS. |
| O21 | Withdrawn articles | **[E] decided:** simply gone (404), no stored state. Open: whether a deletion notice is sent through webmention on withdrawal (W15). |
| O26 | Duplicate slugs | **[E] decided:** suffix `-2`, `-3`, the older article keeps the slug. Risk: if an article with an older date and the same slug is added, the URLs swap. A `slug:` in the frontmatter avoids that. |

# C. Operation, law, design

| ID | Topic | Entry / problem |
|---|---|---|
| O15 | Imprint, privacy policy | A blog with comments, email login and server logs probably needs an imprint and a privacy policy. To be clarified legally. Static pages such as "About" and "Imprint" are not provided for in the concept (from Markdown in Nextcloud?). |
| O16 | Design | Name of the site, colors, typography, dark mode, favicon, accessibility were not discussed. Partly settled by the themes (O35). |
| O17 | Open Graph, social cards | Preview images and meta tags were not discussed. |
| O18 | Backup, alerting | Back up Remark42 data and `state`. Channel for build errors (email, push, Matrix?). Remark42 backs up daily to `BACKUP_PATH`, but does not replace an external backup. |
| O19 | Statistics | Entry: none. If there are any, without foreign services. |
| O22 | Moderation | Notification on new comments, anti-spam measures beyond the email requirement. |
| O23 | Development workflow | Working locally (`astro dev` with sample data), tests, linting of the frontmatter schema. |
| O24 | 404 page, `robots.txt` | Not discussed. |
| O25 | Unverified facts | see section D. |
| O35 | Themes | **[E]** Several themes in the style of well-known editor themes (see [Themes](/frontend/themes.md)). **[E]** All ten themes of the preview stay, the default is Solarized Light. **[E]** Syntax colors per theme (lowlight, at build time), Solarized Dark with a dark system setting, fonts self-hosted (W06c). |
| O36 | HEIC photos | Phone photos in HEIC format (iPhone) cannot be processed with the image library in use and are skipped with a note. Open: upload photos as JPEG or add HEIC processing? |
| O37 | Code quality, complexity, mutation tests | Wish of the user (W18): static analysis and later mutation tests with more than 80 %. Open: tools, thresholds, blocking or reporting, scope, run time in the CI. |
| O38 | Glossary and graph | **[E]** Glossary as a kind of content in the same folder, Markdown links, graph local and overall (see [Glossary](/features/glossary.md)). **[E]** Field `type: glossary`, filter **Begriffe**, series `/terms/`, letter view `/glossary/`, terms also in All (marked), labels Kurz and Lang instead of memos and posts. Open: question form of the title with a separate term field as in the model, comments and webmentions on terms, sorting of umlauts. |
| O39 | Languages | **[E]** Development in English, UI language per `MUFFEL_LANG` (de, en), no URL prefix, articles not translated, no history rewrite, English URLs (`/page/N/`, `/glossary/`, `/terms/`, `/search/`). Open: default value, feed and search texts. See [Languages](/ops/language.md). |

# D. Unverified facts (must be proven before implementation)

* Memos: proven from the source code (version 26.11.0): the public list and
  attachments can be fetched without a token if the access mode is PUBLIC,
  paths and fields are in [Memos](/content/memos-source.md). Proven by the
  contract test against a real instance 26.11.0: paths, field names, anonymous
  fetching and the file route, and also that Memos returns the tag `a` for
  `#a/b`. Still unchecked: stability of the `uid`, external attachments.
* Nextcloud: public-share WebDAV with token and password, behavior of
  `getlastmodified`, conflict file patterns.
* webmention.io: public API without a token, parameter `since`, behavior on
  deletion.
* Remark42: admin basic auth on `POST /api/v1/comment` (possible according to the
  source code, no own `BasicAuthChecker` checked), display of links in the
  comment text, widget sorting, iframe or not, operation under a path, length
  limit for comments.
* Migadu: host, ports, sender rules.
* Pagefind: German interface.
* Astro: behavior of the default slugger with umlauts.

# Corrections to earlier statements

* Memos live through `fetch`: discarded, memos come at build time.
* Comments "only on posts": changed to posts and memos.
* Mentions through import into Remark42: discarded (`DeleteAll`), posting through
  the API instead.
* The Remark42 widget was described as an iframe: unconfirmed.
