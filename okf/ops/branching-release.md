---
type: Process
title: Branching and release
description: Branching model, merge method and release procedure for code, images and Compose configuration.
tags: [git, branching, release, ci]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T13:40:00Z }
---

# Decisions

* **[E]** Branching model: GitHub Flow.
  * `main` is always deliverable.
  * One short-lived branch per work package of the [roadmap](/roadmap.md), one
    pull request against `main`, afterwards the branch is deleted.
* **[E]** Pull requests are merged with a squash merge: one commit per work
  package, linear history.
* **[E]** The assistant merges its own pull requests (work packages) itself as
  soon as the CI is green, including the contract test. The user confirmed this
  on 2026-11-03.
* **[E]** Release of the code: a Git tag in CalVer `YY.M.MICRO`, for example
  `26.11.0` or `26.1.0`, without a `v` prefix. `YY` is the two-digit year, `M`
  the month without a leading zero, `MICRO` counts the releases within the
  month starting at 0. The form is valid SemVer (major = year, minor = month,
  patch = counter), so auto-updaters understand the tags. There is no API that
  anyone consumes, so the age of the version counts, not compatibility. Git tag
  and image tag are identical.
* **[E]** The CI builds and publishes the Docker images only on a tag, not on
  every merge. The server deliberately pulls one version, a rollback is the
  previous tag.
* **[E]** Content (articles, memos, mentions) needs no release. The scheduler
  builds it automatically (see [Pipeline](/ops/pipeline.md)).
* **[E]** Git history is never rewritten on `main`. Existing commit messages
  stay as they are. A force push (`--force-with-lease`) is allowed only on the
  author's own, not yet merged feature branches (see
  [Languages](/ops/language.md)).

# Proposals

* **[V]** Branch names: `feature/wNN-<short name>`.
* **[E]** Before building the images, the tag workflow runs the full suite again
  (see [Test strategy](/ops/testing.md)). If it is red, no images appear.
* **[V]** Protection for `main`: a pull request is required, the CI must be
  green. No required reviews, because with the same account for author and
  reviewer they would block themselves (unchecked). The approval is the merge.
* **[V]** Remark42 upgrades run as a release of their own with a backup before
  it, because database changes cannot be undone without a backup.
* **[V]** Dependent work packages (for example W01, W03, W04) are merged one
  after another: the predecessor goes to `main` first, then the follow-up
  branch is created from it. This avoids conflicts from the squash merge on
  stacked branches.
* **[V]** If a PR is temporarily stacked on a feature branch, the CI still
  checks it: the workflow runs for pull requests against any branch, not only
  against `main`. After the predecessor is merged, the base branch is switched
  to `main`. A change of the base branch does not trigger the CI again, that
  needs a push.

# Default branch

The default branch of GitHub was the branch `ccr-01da7c96-avlx2l` (checked with
`git remote show origin` on 2026-11-02), because it was pushed first. `main` is
wanted. The switch is done in GitHub under Settings → Branches → Default
branch. Only after that can the session branch be deleted. State of
2026-11-02, not checked since.

# Risks

* A faulty builder release stops the content updates without the site going
  down. The rule "last good version stays online" and the alerting (O18) catch
  that.
* With tags and images on a tag a registry is needed (O10). The registry has not
  been chosen yet.
* Parallel pull requests all change `okf/log.md` and `okf/open-points.md`.
  Conflicts there are likely and are resolved by a merge.
* CalVer says nothing about breaks. For this service that is intended, because
  there are no consumers. A break that affects operation or configuration (for
  example a new secret) therefore belongs in the release note of the tag.
* Without a leading zero in the month, a pure text sort sorts wrongly
  (`26.10.0` before `26.9.0`). SemVer-aware tools compare numerically and are
  not affected.
* Updaters derive major, minor and patch from the position. The turn of the
  year (`26.12.0` to `27.1.0`) counts as "major", a change of month as "minor".
  For our own images this has no consequences today, because no updaters use
  them (see below).
* With at most one release per month, `MICRO` stays at 0. Several releases in
  the same month count up. The counter starts again at 0 every month.

# Auto-updaters

* **[E]** Renovate opens pull requests for foreign images (Remark42, Caddy,
  Node base images) and for dependencies of the Astro project (pnpm).
* **[E]** Patch updates are merged automatically, without exceptions (also
  Remark42, Astro and Pagefind). Minor and major updates you accept as a pull
  request.
* **[E]** Auto-merge stays limited to patch updates. This was confirmed after
  the first Renovate PRs: a minor update (pnpm `10.28.0` to `10.34.9`) and major
  updates are not merged automatically, Renovate notes "Automerge: Disabled by
  config" in these PRs. An extension to minor updates was postponed because of
  the still thin test suite.
* **[E]** TypeScript stays at version 6 (`allowedVersions: "<7"` in
  `renovate.json`), because `astro check` does not support TypeScript 7. The rule
  came from Renovate PR #7.
* **[E]** After a version appears, Renovate waits 3 days before it merges
  (`minimumReleaseAge`). The validator `renovate-config-validator --strict`
  confirms that the option exists. Whether the waiting time is really kept with
  GitHub's auto-merge is unchecked.
* **[E]** Renovate runs as a GitHub app. You install it for the repo in GitHub.
* **[V]** Auto-merge applies only if the CI is entered as a required check in
  the branch protection of `main` and is green. Before W00 there is no CI, until
  then nothing may be merged automatically.
* **[V]** Auto-merge changes only `main`. A change reaches operation only with
  the next tag. Before every tag it is checked whether a foreign image changed.
  If the Remark42 version changed, a backup runs beforehand, because even patch
  updates can contain database changes. The user deliberately did not want an
  exception for Remark42.
* **[E]** No automatic pulling and starting of images on the server. The server
  deliberately pulls one version.
* **[E]** For the own images there is no updater, because there is no separate
  deploy repo. If that comes later, the SemVer-valid form of the tags already
  fits.
* Details of the configuration are open, for example grouping of updates and
  schedule (O31).
