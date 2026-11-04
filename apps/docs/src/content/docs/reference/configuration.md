---
title: Configuration
description: Every setting of the builder and the site, with defaults and limits.
---

All settings are environment variables, normally in `.env` next to
`compose.yaml`. **Wrong values stop the build** (or the builder at its start) with
a message that names the variable; nothing is silently ignored.

## Content sources

| Variable                        | Default                  | Meaning                                                                                                                                     |
| ------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `MUFFEL_FIXTURES`               | `demo` in `compose.yaml` | `demo` = sample content, empty = real sources. Together with `NEXTCLOUD_URL` it stops the builder. (`1` is the edge-case set of the tests.) |
| `NEXTCLOUD_URL`                 |                          | Address of your Nextcloud, no trailing path needed                                                                                          |
| `NEXTCLOUD_SHARE_TOKEN`         |                          | Token of the public share (letters and digits)                                                                                              |
| `NEXTCLOUD_SHARE_PASSWORD`      |                          | Password of the share. Required.                                                                                                            |
| `NEXTCLOUD_SHARE_PASSWORD_FILE` |                          | File with the password instead (Docker secret). Not together with the one above.                                                            |
| `CONTENT_DIR`                   |                          | A local folder with Markdown instead of Nextcloud (advanced)                                                                                |
| `MEMOS_URL`                     |                          | Address of your Memos instance. Required for real content.                                                                                  |

## Addresses

| Variable                                                  | Default                            | Meaning                                                                                                                             |
| --------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `SITE_URL`                                                | `http://localhost:8080` in Compose | Public address of the blog. Without it there is no sitemap, no RSS feed and no canonical links. Needed for the static comment copy. |
| `COMMENTS_URL`                                            | `http://localhost:8081` in Compose | Public address (origin) of the comments host. Without it there are no comments.                                                     |
| `COMMENTS_SITE_ID`                                        | `muffelblog`                       | The site id in Remark42                                                                                                             |
| `REMARK_INTERNAL_URL`                                     | `http://remark42:8080` in Compose  | How the builder reaches Remark42 inside the network (static comment copy)                                                           |
| `SITE_ADDRESS`, `COMMENTS_ADDRESS`                        | `:80`, `:8081`                     | Host names for our Caddy; a host name turns on HTTPS (`compose.domain.yaml`)                                                        |
| `MUFFEL_PORT`, `MUFFEL_COMMENTS_PORT`, `MUFFEL_MAIL_PORT` | 8080, 8081, 8025                   | Published ports of the local setup                                                                                                  |
| `MUFFEL_RELEASES_DIR`                                     |                                    | Host folder for the releases (`compose.production.yaml`)                                                                            |
| `REMARK_PORT`                                             | 8082                               | Port on `127.0.0.1` for Remark42 (`compose.production.yaml`)                                                                        |
| `MUFFEL_VERSION`                                          | `latest`                           | Tag of the builder image                                                                                                            |

## Secrets and mail

| Variable                                                               | Meaning                                                                                                                                                   |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REMARK_SECRET`, `REMARK_ADMIN_PASSWD`                                 | Required. `docker/init-env.sh` creates them. `REMARK_ADMIN_PASSWD` is the administrator login of Remark42: keep it private.                               |
| `MAIL_FROM`                                                            | Sender of the login mails and of the notifications                                                                                                        |
| `REMARK_ADMIN_EMAIL`                                                   | Whoever logs in with this address by email administers the comments. Default in the local demo: `admin@localhost`. **Required** in production.            |
| `TRUSTED_PROXY`                                                        | Network your reverse proxy connects from (default `172.16.0.0/12`, the Docker networks). See [Your own reverse proxy](/muffelblog/production/own-proxy/). |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_TLS` | The mail server. Locally Mailpit. Required in production.                                                                                                 |

## Behaviour

| Variable                         | Default | Range          | Effect                                                                                 |
| -------------------------------- | ------- | -------------- | -------------------------------------------------------------------------------------- |
| `MUFFEL_FEED_PAGE_SIZE`          | 20      | 1 to 200       | Entries per block of the feed                                                          |
| `MUFFEL_FEED_EXCERPT_CHARS`      | 200     | 20 to 2000     | Length of the excerpt of a post in the feed                                            |
| `MUFFEL_MEMOS_DESCRIPTION_CHARS` | 160     | 20 to 500      | Length of the description of a memo page                                               |
| `MUFFEL_MEMOS_TIMEOUT_MS`        | 30000   | 1000 to 300000 | Time limit per request to Memos and Remark42                                           |
| `MUFFEL_MEMOS_MAX_FILE_MB`       | 25      | 1 to 500       | Largest mirrored memo file                                                             |
| `MUFFEL_RSS_ITEMS`               | 50      | 1 to 500       | Entries in the RSS feed                                                                |
| `MUFFEL_RELEASES_KEPT`           | 3       | 1 to 50        | Releases kept on disk                                                                  |
| `MUFFEL_CHECK_INTERVAL_SECONDS`  | 180     | 10 to 3600     | Seconds between two checks of the sources                                              |
| `MUFFEL_DEBOUNCE_CHECKS`         | 1       | 0 to 10        | Equal checks a change must survive before it is built                                  |
| `MUFFEL_ALERT_WEBHOOK`           |         | URL            | Receives a POST when a build fails and when it works again                             |
| `MUFFEL_ALERT_FORMAT`            | `text`  | `text`, `json` | `text`: plain body with a `Title` header (ntfy), `json`: `{"text": ...}` (Slack style) |

Numbers must be whole numbers inside the range.
