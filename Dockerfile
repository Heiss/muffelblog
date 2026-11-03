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
