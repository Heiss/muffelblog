---
title: NPMPlus and a shared Docker network
description: A complete container-to-container reverse proxy setup, with matching listeners, two networks and no published host ports.
---

Use this pattern when NPMPlus (or another Docker reverse proxy) runs on the same
Docker daemon as Muffelblog. It is an alternative to the default host-port
setup, including on Unraid. Your proxy configuration is owned by NPMPlus;
Muffelblog owns its Compose files, `.env` and `docker/Caddyfile`. Change proxy
hosts through the NPMPlus interface, not its generated nginx files.

## Prerequisites and exact routing

Docker Compose **2.24.4 or newer** is required for the override's `!reset` tag.
The external Docker network must already exist and the NPMPlus container must
be attached to it. The example calls it `web`; use your actual network name.
Keep the regular production `.env` settings from
[Getting started](/muffelblog/start/getting-started/).

```text
NPMPlus ── external web network ── muffelblog-web:8380 → static blog
                              └─ muffelblog-web:8381 → Caddy → remark42:8080
                                                                   │
                      Caddy and Remark42 share the Compose default network
```

The checked-in `compose.proxy-network.yaml` removes **all** `web` host port
publishing, attaches Caddy to both networks, gives it alias `muffelblog-web` on
the external network, and sets its listeners to 8380/8381. The standard Caddyfile
reads these listener settings; you do not need a separate Caddyfile.

In `.env`, set:

```sh
COMPOSE_FILE=compose.yaml:compose.proxy-network.yaml
MUFFEL_PROXY_NETWORK=web
```

Keep any other override files your deployment needs; `COMPOSE_FILE` is a complete
list, not an additive setting. Run these commands from the checkout directory:

```sh
docker compose version
docker network inspect web --format '{{.Name}}'
docker compose config --quiet
docker compose up -d
```

Expected: the network's name, successful validation, and running services. A
missing external network is an error; create or select it in your Docker/Unraid
management interface and attach NPMPlus there. Do not replace the existing
network blindly. For a deployment using a renamed `docker-compose.yml`, use
that actual base filename in the list instead of assuming both files match.

Configure two NPMPlus Proxy Hosts through its interface:

| Public hostname        | Upstream scheme | Forward hostname | Forward port |
| ---------------------- | --------------- | ---------------- | ------------ |
| `blog.example.org`     | HTTP            | `muffelblog-web` | `8380`       |
| `comments.example.org` | HTTP            | `muffelblog-web` | `8381`       |

NPMPlus owns DNS-facing TLS configuration. `SITE_URL` and `COMMENTS_URL` in
Muffelblog's `.env` must use the corresponding public HTTPS addresses. If you
change `MUFFEL_WEB_LISTEN_PORT` or `MUFFEL_COMMENTS_LISTEN_PORT`, update the
NPMPlus forwarding ports to match, recreate `web`, and recheck both routes.
These are container ports; `MUFFEL_PORT` and `MUFFEL_COMMENTS_PORT` are host
ports used only by the default setup. No host ports are needed in this pattern,
so an unrelated service occupying host port 8080 is not a conflict here.

## Prove each hop

Inspect only the fields needed; full Compose or container dumps can contain
credentials:

```sh
docker inspect --format '{{json .NetworkSettings.Networks}}' "$(docker compose ps -q web)"
```

Expected: the external `web` network with alias `muffelblog-web`, and the
project's default network. The actual default network name depends on the
Compose project name. Inspect NPMPlus's container the same way: it must also be
on `web`. If Caddy has no networks, recreate **web only** after correcting the
Compose configuration; do not edit generated NPMPlus files.

Then test the public routes (no authentication required):

```sh
curl -fsS -o /dev/null -w '%{http_code}\n' https://blog.example.org/
curl -fsS 'https://comments.example.org/api/v1/last/1000?site=muffelblog' -o /dev/null -w '%{http_code}\n'
curl -fsS https://comments.example.org/web/embed.js -o /dev/null -w '%{http_code}\n'
```

All three should return **200** once a release is online. Remark42 1.18.0 also
serves `/web/embed.mjs`; Muffelblog itself requests `/web/embed.js`. The comments
host's `/` may return **404** and still be working correctly. Test the API and
widget instead. A `502` from NPMPlus means a proxy hop failed: check its upstream
hostname, network membership and port, then its logs.

A healthy Caddy container only proves its internal `/healthz` responds. A
healthy builder only proves a release marker exists. Neither proves the public
proxy can reach the service or that source polling is current. Check public
HTTP responses and the age/state of `/health.json` as described in
[Operations](/muffelblog/production/operations/).

This is a reproducible upstream configuration; the specific Unraid/NPMPlus UI
clicks remain deployment-dependent. It does not change NPMPlus settings for you.
