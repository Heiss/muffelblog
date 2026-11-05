---
title: Getting started
description: Put the blog on your server behind your own reverse proxy, with Docker Compose and a few variables.
---

The blog runs with Docker Compose on your server. Your reverse proxy handles
HTTPS and forwards two host names to it. You configure everything in one file,
`.env`.

```text
visitor ──https──► your reverse proxy ──http──► 127.0.0.1:8080  blog
                                       └─http──► 127.0.0.1:8081  comments
```

## What you need

- A server with **Docker** and **Docker Compose**.
- A **reverse proxy with HTTPS** on that server, for example Caddy, nginx or
  Traefik. If you have none yet, Caddy is the shortest way: see the
  [Caddy reverse proxy quick start](https://caddyserver.com/docs/quick-starts/reverse-proxy).
- **Two host names**: one for the blog (`blog.example.org`) and one for the
  comments (`comments.example.org`).
- A **Nextcloud folder** shared as a public link with a password:
  [Connect Nextcloud](/muffelblog/guides/nextcloud/).
- A **Memos** instance that the server can read without a login:
  [Connect Memos](/muffelblog/guides/memos/).
- A **mailbox** that can send mail (SMTP), for the login mails of the comments.

## 1. Get the project

```sh
git clone https://github.com/Heiss/muffelblog.git
cd muffelblog
docker/init-env.sh
```

`docker/init-env.sh` creates `.env` with two random secrets for the comments
server. It never overwrites an existing `.env`.

## 2. Fill in `.env`

Open `.env` and fill in the required values:

| Variable                         | What                                                    | Example                        |
| -------------------------------- | ------------------------------------------------------- | ------------------------------ |
| `SITE_URL`                       | Public address of the blog, as your proxy serves it     | `https://blog.example.org`     |
| `COMMENTS_URL`                   | Public address of the comments, as your proxy serves it | `https://comments.example.org` |
| `NEXTCLOUD_URL`                  | Address of your Nextcloud                               | `https://cloud.example.org`    |
| `NEXTCLOUD_SHARE_TOKEN`          | The part of the share link after `/s/`                  | `AbC123xyz`                    |
| `NEXTCLOUD_SHARE_PASSWORD`       | Password of the share link                              |                                |
| `MEMOS_URL`                      | Address of Memos, as the server reaches it (no token)   | `https://memos.example.org`    |
| `MAIL_FROM`                      | Sender of the login mails                               | `blog@example.org`             |
| `REMARK_ADMIN_EMAIL`             | Your address: whoever logs in with it moderates         | `you@example.org`              |
| `SMTP_HOST`, `SMTP_PORT`         | Your mail server                                        | `smtp.example.org`, `465`      |
| `SMTP_USERNAME`, `SMTP_PASSWORD` | Login of the mailbox (empty if the server needs none)   |                                |

`REMARK_SECRET` and `REMARK_ADMIN_PASSWD` are already filled in. `.env` holds
secrets: it is not committed, keep it private.

**Decide `SITE_URL` before you publish.** The comments and the RSS feed use it as
an identifier.

All optional settings (language, ports, check interval, alerts, webmentions, ...)
are in the [Configuration](/muffelblog/reference/configuration/) reference.

## 3. Set up your reverse proxy

Your proxy needs exactly this:

| Host name                     | Forward to (plain HTTP) |
| ----------------------------- | ----------------------- |
| the host of `SITE_URL` (blog) | `127.0.0.1:8080`        |
| the host of `COMMENTS_URL`    | `127.0.0.1:8081`        |

- HTTPS certificates for both names.
- Send the visitor's address in `X-Forwarded-For` (Caddy and Traefik do it by
  themselves; for nginx see the example).

That is all: security headers, caching and the protection of the comments
administrator are done by the blog itself. Ready-made snippets for Caddy, nginx
and Traefik: [Reverse proxy examples](/muffelblog/production/reverse-proxy/).

If your proxy runs **in a container or on another machine**, it cannot reach
`127.0.0.1` of this host. Then set `MUFFEL_BIND` to an address of this host that
the proxy reaches, and `MUFFEL_TRUSTED_PROXIES` to the address of the proxy
(details on the examples page).

## 4. Start

```sh
docker compose up -d
```

This pulls the published builder image. Before the first release, or while the
image is not public yet, build it on the server instead: `docker compose up -d
--build`.

The first start takes a few minutes: the builder fetches your content and builds
the site, then the web server starts. Follow it with
`docker compose logs -f builder`; it ends with a line like
`release ... is online`. Then open your blog.

New content is online 3 to 6 minutes after you save it in Nextcloud or Memos.

## If it does not work

`docker compose up` names a missing required variable itself. Everything else is
in the log of the builder (`docker compose logs builder`):

| You see                                          | Meaning and fix                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `No content source: set NEXTCLOUD_URL ...`       | The Nextcloud values in `.env` are missing.                                      |
| The Nextcloud share is empty                     | Wrong token, or the folder is empty. Open the share link in a private window.    |
| A wrong-password or login error from Nextcloud   | `NEXTCLOUD_SHARE_PASSWORD` does not match the share.                             |
| `MEMOS_URL is required ...`                      | `MEMOS_URL` is missing.                                                          |
| The Memos instance requires a login              | Anonymous reading of public memos is switched off in Memos.                      |
| The log is fine, the browser shows an error page | Your proxy does not reach `127.0.0.1:8080`: check the forward and `MUFFEL_BIND`. |

While something fails, the last good version stays online.

## Next

- [Writing](/muffelblog/guides/writing/): posts, images, glossary terms.
- [Comments](/muffelblog/guides/comments/): moderation.
- [Webmentions](/muffelblog/guides/webmentions/): off by default.
- [Operations](/muffelblog/production/operations/): status, backups, updates.
