# Muffelblog

Static blog with a Memos microblog. The specification is an OKF bundle in
[`okf/`](okf/index.md). Development is in English
([language rules](okf/ops/language.md)).

## Preview

Status with demo content (IT, photography, timber construction; the images are placeholders). Nextcloud integration, operations and comments are
still missing (see the [roadmap](okf/roadmap.md)). There are ten color schemes,
the default is Solarized Light.

| Feed, Solarized Light                          | Feed, Dracula                                   |
| ---------------------------------------------- | ----------------------------------------------- |
| ![Feed wide](docs/screenshots/feed-breit.webp) | ![Feed dark](docs/screenshots/feed-dunkel.webp) |

| Feed mobile                                      | Article                                   | Article, Matrix                                         |
| ------------------------------------------------ | ----------------------------------------- | ------------------------------------------------------- |
| ![Feed mobile](docs/screenshots/feed-mobil.webp) | ![Article](docs/screenshots/artikel.webp) | ![Article Matrix](docs/screenshots/artikel-matrix.webp) |

| Tags                                |
| ----------------------------------- |
| ![Tags](docs/screenshots/tags.webp) |

The images are taken from the built site with sample data and can be
regenerated with `pnpm screenshots` (needs a browser, see below).

## Structure

| Path            | Content                                     |
| --------------- | ------------------------------------------- |
| `apps/site`     | Astro site                                  |
| `apps/builder`  | Scheduler, sync and mention jobs (scaffold) |
| `packages/core` | Shared code of site and builder             |
| `okf/`          | Specification, roadmap, decisions           |

## Requirements

- Node 26 (see `.node-version`)
- pnpm 10 (version in `package.json`)

Corepack has not been part of Node since version 25. Install pnpm for example
with `npm install --global pnpm@10.28.0`.

## Commands

```sh
pnpm install              # dependencies
pnpm lint                 # ESLint
pnpm format:check         # Prettier (pnpm format writes)
pnpm typecheck            # tsc and astro check
pnpm test                 # unit tests (Vitest)
pnpm build                # build the site
pnpm test:e2e             # E2E tests (Playwright) against apps/site/dist
pnpm check                # lint, format:check, typecheck, test and build
pnpm dev:demo             # dev server with the demo content (IT, photography, timber)
pnpm screenshots          # regenerate the README images (docs/screenshots)
```

The E2E tests need a browser for Playwright:
`pnpm --filter @muffelblog/site exec playwright install chromium`.
Alternatively, `CHROMIUM_PATH` can point to an existing Chromium.

## Docker

```sh
docker build --target site-dist --output type=local,dest=out .
```

This writes the built site to `out/`.

## CI

`.github/workflows/ci.yml` checks every pull request. The **CI Gate** job is the
required check for `main`. Changes only to `okf/` and to Markdown files in the
root directory skip the heavy checks.
