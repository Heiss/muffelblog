---
type: Open Questions
title: Open points from the critical review
description: What is still open before and after the first release, and the settled points with their result.
tags: [open, review, risks]
status: draft
generated: { by: claude-code/web, at: 2026-11-05T10:45:00Z }
---

The IDs (O1 to O39) are referenced in the other concepts. Settled points stay
listed with their result, so those references keep working. Cleaned up on
2026-11-05 against the log, the code and the repository.

# A. Open: decision of the owner

Each point has a proposal **[V]** of the assistant; it counts only once the owner
confirmed it.

| ID | Topic | What is open | Proposal [V] |
|---|---|---|---|
| O3, O11, O32 | Receiving webmentions (W14) | W14 is not built: `rel=webmention`, `rel=me`, display of mentions, recovery of the state (O3), read test against webmention.io (O32). Needs the domain. | Not in 26.11.0; after the release, once the domain is live. |
| O8 | Memos version | "Always newest" against pinning. The contract test and the docs pin 26.11.0; an API change of Memos can stop the build. | Pinned reference version 26.11.0; newer versions are raised by hand after the contract test. |
| O16 | Favicon | White M on blue, chosen by the assistant (2026-11-05). | Review by the owner. |
| O17 | Social preview images | Open Graph tags are done (W10); preview images are not. | After 26.11.0. |
| O19 | Statistics | Entry: none; if any, without foreign services. Never confirmed. | None in 26.11.0. |
| O27 | Reading of "standalone" | Entry: the delivered site runs without Nextcloud, Memos and foreign services. Implemented like that, never confirmed. | Confirm. |
| O31 | Renovate details | Grouping of updates, schedule, whether the waiting time holds with auto-merge. Renovate runs. | Keep as it runs; revisit after the release. |
| O34 | Visibility of the repo | Public repos have unlimited CI minutes, private ones do not. | Decision of the owner. |
| O38 | Glossary details | Question form of the title with a separate term field, comments and webmentions on terms, sorting of umlauts. | After 26.11.0. |

# B. Open: tasks of the owner for the go-live (W17)

| ID | Topic | State |
|---|---|---|
| O15 | Imprint, privacy policy | Static pages and templates with placeholders exist (`examples/nextcloud-folder/pages/`). The texts themselves are written by the owner. |
| O9 | Domain | Setup decided (see C). The real domain, DNS and the first run on a server follow after the release, by the owner. |

# C. Settled

| ID | Topic | Result |
|---|---|---|
| O1 | Block series for the filter | Three series (mixed, memos, posts), blocks of 20 (W05). |
| O2 | Date format and time zone | Plain date = 12:00 Berlin time, time without zone = Berlin local time. |
| O4 | Remark42 display | Mentions in the timeline belong to W14 (see A). Widget sorting and the display of `admin` are unchecked, see D. |
| O5 | Foreign content in Markdown | Only from allowlists (images: Wikimedia, GitHub; embeds: youtube-nocookie after a click). |
| O6 | Attachments | PDF, audio, video mirrored with size limit and signature check. |
| O7 | Image sizes and formats | WebP in widths 480 to 1920, EXIF removed, SVG rejected. |
| O9 | Reverse proxy, Remark42 host | The operator's reverse proxy forwards to our Caddy on `127.0.0.1:8080/8081`; Remark42 on a host of its own (2026-11-05, see [Docker](/architecture/docker.md)). |
| O10 | Image build | GitHub Actions, images only on a CalVer tag, registry GHCR. |
| O11 | Webmentions sender | Own module; `h-entry`/`h-card` exist. `rel=me` and IndieAuth belong to W14 (see A). |
| O12 | Sending from memos | Posts, memos and terms send. Off by default. |
| O13 | Tag rules | Lowercase, nested Memos tags stay one tag, tag pages (W05). Inline `#tags` in articles: postponed ("later", [Frontmatter](/content/frontmatter.md)). |
| O14 | Memo date | `createTime`; title from date and time. |
| O18 | Backup, alerting | `docker/backup.sh`, `docker/restore.sh`, alert webhook `MUFFEL_ALERT_WEBHOOK` (W12, W16). |
| O20 | Feed and RSS | Excerpt at most 200 characters; RSS with full text, 50 entries (`MUFFEL_RSS_ITEMS`, W09). |
| O21 | Withdrawn articles | Gone (404); a removed entry or link is reported once more through webmention (W15). |
| O22 | Moderation | Administrator by email, mail on every comment, command line tools. No anti-spam beyond the email login (owner: not wanted for now). |
| O23 | Development workflow | `astro dev` with the sample sets, tests, frontmatter schema checks. |
| O24 | 404, `robots.txt` | Done (W10). |
| O25 | Unverified facts | See D. |
| O26 | Duplicate slugs | Suffix `-2`, `-3`; `slug:` in the frontmatter avoids swaps. |
| O28 | Base branch | `main`. |
| O29 | Test strategy | TDD with mocks, E2E and contract tests against pinned instances, full suite per PR and on the tag. |
| O30 | Default branch | `main` (checked 2026-11-05). |
| O33 | Branch must be up to date | Active in the branch protection; PRs are merged one after another. |
| O35 | Themes | Ten themes, default Solarized Light. |
| O36 | HEIC photos | Converted with libheif in the builder image ([Media](/content/media.md)). |
| O37 | Code quality, mutation tests | Postponed to W18, after the release (roadmap). |
| O39 | Languages | Development in English, `MUFFEL_LANG` with default `en`, feeds and search follow the build language. |

# D. Unverified facts

* Remark42: widget sorting, display of the author `admin`, links in the comment
  text, length limit, operation under a path. (Admin basic auth on the API is
  proven: the moderation tools use it in CI.)
* Mail providers (for example Migadu): host, ports, sender rules.
* webmention.io: belongs to W14.
* Memos: stability of the `uid`, external attachments (see
  [Memos](/content/memos-source.md)).
* EXIF orientation of converted HEIC photos.

Proven since the review: Memos API and anonymous reading (contract test
26.11.0), Nextcloud public share over WebDAV (contract test), German search
interface (own search UI), umlauts in slugs (own slug function with tests).

# Corrections to earlier statements

* Memos live through `fetch`: discarded, memos come at build time.
* Comments "only on posts": changed to posts and memos.
* Mentions through import into Remark42: discarded (`DeleteAll`), posting through
  the API instead.
* The Remark42 widget was described as an iframe: unconfirmed.
