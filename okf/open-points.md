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

# A. Decided on 2026-11-05, to be built before 26.11.0

| ID | Topic | Decision of the owner |
|---|---|---|
| O8 | Supported versions | Pinned versions, never "latest". The supported versions are listed in the docs. Contract tests run in parallel for the current and the previous version (Memos and Nextcloud); Renovate opens a PR when a new version appears, the contract test shows whether it works. |
| O17 | Social preview images | Generated per page at build time (posts, memos, terms); developed and checked with the demo set. |
| O19 | Statistics | View counter per post, memo and term: visitors per day from the access log of our Caddy (only a hash with a daily changing salt, never the address; bots filtered), baked into the HTML at every build, shown publicly on the page. On by default, `MUFFEL_STATS=0` switches it off. GoAccess as an extra container is described in the docs only. |

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
| O3, O32 | Receiving webmentions (W14) | Built 2026-11-05 with the stand-in of webmention.io; state recovery from the comments of the administrator ([Webmentions](/community/webmentions.md)). A read test against the live webmention.io does not run in CI (external service). |
| O4 | Remark42 display | Mentions in the timeline: W14 (see A). Widget sorting and the display of `admin` are unchecked, see D. |
| O5 | Foreign content in Markdown | Only from allowlists (images: Wikimedia, GitHub; embeds: youtube-nocookie after a click). |
| O6 | Attachments | PDF, audio, video mirrored with size limit and signature check. |
| O7 | Image sizes and formats | WebP in widths 480 to 1920, EXIF removed, SVG rejected. |
| O16 | Favicon | White M on blue, accepted by the owner. |
| O27 | Reading of "standalone" | The delivered site stays online and readable when Nextcloud, Memos or Remark42 are down (last good release, static comment copy). Confirmed by the owner. |
| O31 | Renovate details | Kept as it runs; grouping and schedule are looked at after the release. |
| O34 | Visibility of the repo | Public. |
| O9 | Reverse proxy, Remark42 host | The operator's reverse proxy forwards to our Caddy on `127.0.0.1:8080/8081`; Remark42 on a host of its own (2026-11-05, see [Docker](/architecture/docker.md)). |
| O10 | Image build | GitHub Actions, images only on a CalVer tag, registry GHCR. |
| O11 | Webmentions sender and microformats | Own module; `h-entry`/`h-card` exist; `rel=me` from `MUFFEL_REL_ME` (W14). |
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
| O38 | Glossary details | Done 2026-11-05: optional field `term:` (title may be a question, letter view sorts by the term), comments on terms, umlauts under the base letter (collator `de`). |
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
