---
okf_version: "0.2"
---

# Overview

* [Overview and goals](/overview.md) - purpose, scope, legend of the markers (E/V/U)
* [Open points](/open-points.md) - result of the critical review, prioritized

# Planning

* [Roadmap](/roadmap.md) - work packages with dependencies and definition of done

# Architecture

* [System architecture](/architecture/system.md) - components, data flows, basic rules
* [Docker operation](/architecture/docker.md) - services, volumes, secrets, release swap

# Content and sources

* [Nextcloud source](/content/nextcloud-source.md) - public share, sync, exclusions
* [Frontmatter schema](/content/frontmatter.md) - required fields, fallbacks, tags, slug
* [Memos source](/content/memos-source.md) - fetching at build time, memo pages
* [Media](/content/media.md) - mirroring images, foreign content

# Frontend

* [Feed](/frontend/feed.md) - combined feed, filter, endless scroll
* [Live update](/frontend/live-update.md) - build.json and the banner "N new entries"
* [URLs and SEO](/frontend/urls-seo.md) - URL scheme, canonical, sitemap
* [Themes](/frontend/themes.md) - color schemes in the style of well-known editor themes

# Features

* [Search](/features/search.md) - Pagefind
* [RSS](/features/rss.md) - combined feed
* [Glossary and knowledge graph](/features/glossary.md) - terms, letter view, linking, graph

# Community

* [Comments](/community/comments.md) - Remark42 with email login
* [Webmentions](/community/webmentions.md) - receiving, sending, display as Remark42 comments

# Security

* [Sanitizing foreign content](/security/sanitization.md) - sanitizing, SSRF protection, secrets
* [Security review](/security/review.md) - what was checked for the first release, findings and open points

# Operations

* [Build pipeline](/ops/pipeline.md) - scheduler, change detection, atomic swap, failure rules
* [Test strategy](/ops/testing.md) - Vitest, Playwright, contract tests, full suite per PR
* [Branching and release](/ops/branching-release.md) - GitHub Flow, squash merge, CalVer tags YY.M.MICRO, auto-updaters
* [Configuration](/ops/config.md) - environment variables for numeric settings, ranges, failure behavior
* [Languages](/ops/language.md) - Development in English, UI language per variable, translation order
* [Defaults stay inside](/ops/defaults.md) - a fresh instance does not talk to the outside world
