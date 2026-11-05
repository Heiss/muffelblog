# syntax=docker/dockerfile:1

# Base: Node 26 (see .node-version). Corepack has not been part of Node since
# version 25, so pnpm comes through npm in the version from package.json.
FROM node:26-slim AS base
WORKDIR /repo
ENV CI=true \
    ASTRO_TELEMETRY_DISABLED=1
COPY package.json ./
RUN npm install --global "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")"

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile

FROM deps AS site-build
RUN pnpm build

# Only the result of the site, exportable with
# docker build --target site-dist --output type=local,dest=out .
FROM scratch AS site-dist
COPY --from=site-build /repo/apps/site/dist/ /

# The builder: builds the site into a new release folder and switches the link
# `current`. Run with `docker build --target builder .`
FROM deps AS builder
# rclone fetches the Nextcloud share (WebDAV); pinned like every other image.
COPY --from=rclone/rclone:1.75.2 /usr/local/bin/rclone /usr/local/bin/rclone
ENV REPO_DIR=/repo \
    RELEASES_DIR=/data/releases
# Not root: the builder fetches content from outside and runs a build. The user
# `node` (uid 1000) of the base image owns what the builder writes: the data
# folders (a new Docker volume takes over this owner from the image) and the
# places where Astro and Vite write while they build. Everything else in /repo
# stays owned by root and read-only for the builder.
RUN mkdir -p /data/releases /data/cache /data/state \
 && chown -R node:node /data /repo/apps /repo/packages
USER node
WORKDIR /repo/apps/builder
CMD ["pnpm", "start"]
