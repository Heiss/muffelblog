---
title: '2. Set up and publish'
description: Install the blog on a server with your own reverse proxy, enter the secrets in the right places, and see the first post and memo.
---

You need what [chapter 1](/muffelblog/tutorial/1-prepare/) gave you: the share
token and password, the Nextcloud and Memos addresses.

## 1. Get the project and the secrets

On your server:

```sh
git clone https://github.com/Heiss/muffelblog.git
cd muffelblog
docker/init-env.sh
sudo mkdir -p /srv/muffelblog/releases
```

`docker/init-env.sh` creates `.env` with fresh random secrets for Remark42
(`REMARK_SECRET`, `REMARK_ADMIN_PASSWD`). You do not type those. It never
overwrites an existing `.env`.

Create the two DNS records for `blog.example.org` and `comments.example.org`
that point at this server.

## 2. Fill in `.env`

Open `.env` and set these values. The table below says where each one comes from.

```sh
# Real content instead of the demo (empty switches the demo off)
MUFFEL_FIXTURES=

# Where the blog and the comments are reached
SITE_URL=https://blog.example.org
COMMENTS_URL=https://comments.example.org

# Chapter 1: the Nextcloud share and Memos
NEXTCLOUD_URL=https://cloud.example.org
NEXTCLOUD_SHARE_TOKEN=AbC123xyz
NEXTCLOUD_SHARE_PASSWORD=the-share-password
MEMOS_URL=https://memos.example.org

# Own reverse proxy: the folder it serves, shared with the builder
MUFFEL_RELEASES_DIR=/srv/muffelblog/releases

# Login mails of the comments
MAIL_FROM=blog@example.org
REMARK_ADMIN_EMAIL=you@example.org
SMTP_HOST=smtp.example.org
SMTP_PORT=465
SMTP_USERNAME=blog@example.org
SMTP_PASSWORD=the-mailbox-password
SMTP_TLS=true
```

| Variable                                            | Where it comes from                                         | Secret?  |
| --------------------------------------------------- | ----------------------------------------------------------- | -------- |
| `NEXTCLOUD_SHARE_TOKEN`, `NEXTCLOUD_SHARE_PASSWORD` | The share link of chapter 1. No Nextcloud account password. | password |
| `MEMOS_URL`                                         | Your Memos address. **No token** is needed.                 | no       |
| `REMARK_SECRET`, `REMARK_ADMIN_PASSWD`              | Created by `docker/init-env.sh`.                            | yes      |
| `SMTP_USERNAME`, `SMTP_PASSWORD`                    | The mailbox you send the login mails from.                  | password |
| `REMARK_ADMIN_EMAIL`                                | The address **you** log in with to moderate (chapter 3).    | no       |
| `MUFFEL_RELEASES_DIR`                               | A folder on the server that your proxy serves.              | no       |

`.env` is never committed. Keep it that way; it holds all of these secrets.

Details of the variables: [Configuration](/muffelblog/reference/configuration/).

## 3. Your reverse proxy

Before the blog can be reached, your proxy must serve
`/srv/muffelblog/releases/current` for the blog host and forward the comments
host to Remark42. Copy the example for your proxy from
[Your own reverse proxy](/muffelblog/production/own-proxy/) and replace
`blog.example.org`, `comments.example.org` and the certificate paths. The
Content Security Policy in the example must stay exactly as it is.

:::caution[Two things the proxy must do for the comments host]
Refuse requests that carry `Authorization: Basic ...` (that is the
administrator login), and set `X-Real-IP` itself. Both are in the examples.
:::

## 4. Start

```sh
docker compose -f compose.yaml -f compose.production.yaml up -d --build
```

`--build` builds the builder image on this machine. The first start takes a few
minutes.

**Check, step by step:**

```sh
docker compose logs -f builder
```

You should see lines like these (the numbers differ):

```text
[builder] Nextcloud: 5 files, changed
[builder] release 20261104T100000Z is online in /data/releases/current
[builder] check: built
```

```sh
docker compose exec builder cat /data/state/status.json
```

shows `"state": "ok"`. Then open `https://blog.example.org` in a browser:

- the feed shows **Hello, world**, your **first memo** (titled with its date and
  time) and the glossary term **Webmention**;
- the footer links **Legal notice** and **Privacy policy**;
- **Search** finds "webmention".

New content is online 3 to 6 minutes after you save it (the builder checks every
3 minutes and waits for one more equal check).

## If it does not work

| You see in the log                             | Meaning and fix                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| The Nextcloud share is empty                   | Wrong token, or the folder is empty. Open the link of chapter 1 again.                            |
| A wrong-password or login error from Nextcloud | The share password in `.env` does not match.                                                      |
| The Memos instance requires a login            | Anonymous reading of public memos is off in Memos.                                                |
| `MUFFEL_FIXTURES` is set                       | `MUFFEL_FIXTURES=` must be empty, otherwise the builder refuses to mix demo and real content.     |
| The site shows nothing, the log is fine        | Your proxy does not serve `/srv/muffelblog/releases/current`. Check the path and the permissions. |

While something fails, the last good version stays online, and the status file
tells what failed. More: [Operations](/muffelblog/production/operations/).

Next: [3. Comments and moderation](/muffelblog/tutorial/3-comments/).
