# syntax=docker/dockerfile:1

# Basis: Node 26 (siehe .node-version). Corepack gehört seit Node 25 nicht mehr
# zur Auslieferung, pnpm kommt deshalb über npm in der Version aus package.json.
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

# Nur das Ergebnis der Seite, exportierbar mit
# docker build --target site-dist --output type=local,dest=out .
FROM scratch AS site-dist
COPY --from=site-build /repo/apps/site/dist/ /
