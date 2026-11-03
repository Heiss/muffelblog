---
type: Policy
title: Test strategy
description: Binding kinds of tests, tools, cadence of the suite and the role of the tests for required checks and auto-merge.
tags: [tests, tdd, e2e, contract-tests, ci, vitest, playwright]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T14:40:00Z }
---

# Decisions

* **[E]** TDD with mocks for the logic: the test comes first. This concerns the
  loader, the frontmatter schema, slugs, sanitizing, the scheduler and the
  mention sync. External services are replaced by mocks and sample responses.
* **[E]** Unit tests with Vitest.
* **[E]** E2E tests with Playwright, in the browser against the built site.
* **[E]** Contract tests against real test instances (Nextcloud, Memos,
  Remark42, mail sink as containers).
* **[E]** The whole suite runs on every pull request, so no error reaches
  `main`. This replaces the earlier version "contract tests only before every
  tag".
* **[E]** The test instances are pinned. Renovate updates their versions
  through pull requests, and these pull requests go through the full suite.
* **[E]** The tag workflow runs the suite again before images are published.
* **[E]** Pure documentation PRs (only `okf/` or Markdown files in the root)
  are handled by a gate job with path detection: the required check always
  runs, but starts the heavy tests only if code is affected. The first such PR
  on GitHub (W22a) confirmed the path: the four heavy jobs were skipped and
  `CI Gate` was green.
* **[E]** Visual regression is not part of it.

# Sample data

* **[E]** Two sets exist (decided on 2026-11-03):
  * The **edge-case fixtures** (`packages/core/fixtures/content` and `memos`,
    `MUFFEL_FIXTURES=1`): deliberately odd files (wikilink, conflict copy,
    duplicate, unsafe HTML, no date). The unit and E2E tests rely on their names
    and numbers.
  * The **demo set** (`packages/core/fixtures/demo`, `MUFFEL_FIXTURES=demo`):
    realistic sample content on three topics (IT, photography, timber
    construction), each with 3 articles, 3 memos and 5 glossary terms (9, 9 and
    15 in total). Used for the README images (`pnpm screenshots`) and for
    development (`pnpm dev:demo`).
* **[E]** The demo images are generated placeholders, clearly marked as such
  (`generate-images.mjs`), never photos.
* **[E]** The glossary terms carry `type: glossary` already (folder
  `content/glossar/`). Until W19 they appear as normal articles.
* A unit test (`packages/core/src/demo.test.ts`) keeps the demo set clean: counts,
  3 + 5 per topic, valid frontmatter, no warnings while rendering, all images
  found. A finding while writing it: an article and a term must not share a file
  name, because the slug comes from the file name.

# Purpose

The user wants to reduce the risk of errors in `main` and in the automatically
merged patch updates with TDD, E2E and contract tests (see
[Branching and release](/ops/branching-release.md)). "Error-free" here means
only: free of what the tests see.

# Scope of the E2E tests (proposal)

* **[V]** The feed shows posts and memos chronologically.
* **[V]** Endless scroll loads blocks without duplicates.
* **[V]** The filter is kept after reloading, without `localStorage` the default
  applies.
* **[V]** The `build.json` banner appears only for newer entries.
* **[V]** Search returns posts and memos, no hits from the blocks.
* **[V]** The page works without JavaScript (next link, static comments).
* **[V]** The home page and articles without foreign content make no request to
  foreign domains. Articles with foreign content call only allowed hosts,
  embeds only after the click.

# Scope of the contract tests (proposal)

* **[V]** Nextcloud: public share through WebDAV with token and password,
  conflict copies, behavior of `getlastmodified`.
* **[V]** Memos: public list, attachments, fields that the loader reads.
  Implemented as `packages/core/contract/memos.contract.test.ts` and the CI job
  "Contract tests" with a Memos instance as a service container
  (`neosmemo/memos:26.11.0`, the image exists, checked in the first run). The
  test creates the first user, sets the access mode to PUBLIC and creates memos
  with an attachment. A "green" run is reliable only if the test was not
  skipped: the job log says "5 passed".
* **[V]** Remark42: `find`, post a comment as `admin`, delete a comment, login
  mail in the mail sink.
* **[V]** webmention.io cannot be run locally. There it stays with mocks.
  Whether a read test against the real service also runs is open (O32).

# Rules

* **[V]** No test is skipped or disabled to make the CI green.
* **[V]** Tests check behavior, not markup. HTML snapshots of the Astro output
  are not the only check.
* **[V]** Required checks for `main`: the gate job, which triggers lint, type
  check, unit, E2E and contract tests and the build depending on the change.
  The gate job always exists, so GitHub does not block the merge because of a
  missing check.
* **[V]** The tag workflow builds images only after a green suite.

# Risks

* **Run time and costs:** Nextcloud, Memos, Remark42 and the mail sink start in
  every run, also for every Renovate PR. Whether the repo is public decides the
  available CI minutes (O34).
* **Flaky tests block everything:** an unstable contract or E2E check holds up
  every PR and every automatic update. Skipping is forbidden, so the tests must
  be stable.
* **Pinned test instances against "newest" in operation:** in operation the real
  Memos and Nextcloud instances run in the newest version. An API change there
  shows up in the suite only when Renovate raises the pinned test version (after
  3 days at the earliest). In the meantime only the rule "on a fetch error the
  last good version stays online" and the alerting (O18) protect. A nightly run
  against `latest` was deliberately not chosen.
* **Mocks drift:** they stay green when the real API changes. Only the contract
  tests see that.
* **Not covered:** database migrations of Remark42 when switching a version and
  the delivery of the login mails through Migadu are checked neither by a mock
  nor by a browser test. The mail sink checks sending, not deliverability.
* **Semantic conflicts:** two PRs that are green at the same time can together
  produce an error in `main`. The branch protection option "branch must be up to
  date" prevents that, but costs re-basing with many Renovate PRs (O33).
