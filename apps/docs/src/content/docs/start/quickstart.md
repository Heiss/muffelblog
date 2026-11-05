---
title: Quickstart
description: Run Muffelblog with demo content on your own machine in a few minutes.
---

You need Docker with Compose and a checkout of the repository. The demo needs no
Nextcloud and no Memos.

## 1. Create the secrets

```sh
git clone https://github.com/Heiss/muffelblog.git
cd muffelblog
docker/init-env.sh
```

`docker/init-env.sh` creates `.env` from `.env.example` with fresh random secrets
for Remark42. It never overwrites an existing `.env`.

## 2. Start

```sh
docker compose up --build
```

`--build` builds the builder image on your machine. Once a release exists you can
leave it out and use the published image (`MUFFEL_VERSION` selects the tag; a new
GitHub Container Registry package is private until you make it public).

The first start takes a few minutes: the builder builds the site, then Caddy
starts.

The ports listen on `127.0.0.1` only, so the demo is not reachable from other
machines. To open it on a trusted network, set `MUFFEL_BIND=0.0.0.0` in `.env`.

## 3. Look around

| What                                       | Where                 |
| ------------------------------------------ | --------------------- |
| The site                                   | http://localhost:8080 |
| Comments server (Remark42)                 | http://localhost:8081 |
| Mail sink (Mailpit), shows the login mails | http://localhost:8025 |

The demo has 9 posts, 9 memos and 15 glossary terms about IT, photography and
timber construction. Images are generated placeholders.

Try a comment: open a post, choose _Login by email_, and read the mail in
Mailpit. A comment you write reaches the page itself within about six minutes
(one check plus one confirming check).

## 4. Stop

```sh
docker compose down            # keep the data
docker compose down --volumes  # delete releases, comments and caches
```

## Next steps

- Use your own content: [Nextcloud](/muffelblog/guides/nextcloud/) and
  [Memos](/muffelblog/guides/memos/).
- Put it on a server: [Production overview](/muffelblog/production/overview/).
