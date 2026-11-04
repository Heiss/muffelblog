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

### Try it locally with Docker Compose

Needs Docker with Compose. The stack serves the demo set (no Nextcloud, no
Memos needed).

```sh
docker/init-env.sh              # creates .env with random secrets
docker compose up --build       # builds the images here and starts everything
```

| What                                                     | Where                 |
| -------------------------------------------------------- | --------------------- |
| Site                                                     | http://localhost:8080 |
| Comments server (Remark42, not yet wired into the pages) | http://localhost:8081 |
| Mail sink (Mailpit)                                      | http://localhost:8025 |

The `builder` builds the site into a new release folder and switches the link
`current` atomically. It keeps running: every `MUFFEL_CHECK_INTERVAL_SECONDS`
(default 180) it checks Nextcloud and Memos and builds again after a change
(see `.env.example`); the status is in `/data/state/status.json`. `web` (Caddy) serves
that release with a strict Content Security Policy. Stop with
`docker compose down` (add `--volumes` to delete the data). Ports and further
settings are in `.env.example`.

`docker/smoke.sh` checks a running stack; CI runs it on every code change.

### Releases

A Git tag like `26.11.0` (year.month.counter, no `v`) runs the whole CI again and
only then publishes `ghcr.io/heiss/muffelblog-builder:<tag>` (amd64 and arm64)
and creates a GitHub release. `docker compose up` then uses the published image
(`MUFFEL_VERSION` selects the tag). A new GHCR package is private until you make
it public in its settings on GitHub.

## CI

`.github/workflows/ci.yml` checks every pull request. The **CI Gate** job is the
required check for `main`. Changes only to `okf/` and to Markdown files in the
root directory skip the heavy checks.
