---
title: Comments
description: Self-hosted comments with Remark42, login by email, moderation and the static copy.
---

Posts and memos have a comment section. It is [Remark42](https://remark42.com),
running next to the blog; you do not need an account anywhere else.

## How it works for readers

- Login is **by email only** (a link in a mail). No anonymous comments, no social logins.
- The comment widget loads from **your own** comments host, never from a third party.
- The comments are also written into the page HTML at build time, sanitized, so
  they read without JavaScript and search engines see them. When the widget has
  loaded, the static copy steps aside.

## Settings

| Variable                                                                            | Meaning                                                                                                                                                          |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REMARK_SECRET`, `REMARK_ADMIN_PASSWD`                                              | Required secrets (created by `docker/init-env.sh`)                                                                                                               |
| `COMMENTS_URL`                                                                      | The address of the comments host **as the browser sees it**, for example `https://comments.example.org`. The Content Security Policy allows exactly this origin. |
| `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_TLS` | The mail server for the login mails                                                                                                                              |
| `SITE_URL`                                                                          | Required for the static copy: the address of a page is the key of its comments                                                                                   |

Locally the login mails go to **Mailpit** (http://localhost:8025) and nothing
leaves your machine. In production you set a real SMTP server (for example
Migadu: host `smtp.migadu.com`, a mailbox of your domain as sender; check the
port and encryption in your provider's settings).

## Moderation

**Not set up yet (open point).** Remark42 needs an admin user for its moderation
interface (for example through `ADMIN_SHARED_EMAIL`), and this setup does not set
one. Until that is decided, comments can only be removed by an operator through
the Remark42 API with `ADMIN_PASSWD` from inside the Docker network. A deleted
comment disappears from the page at the next build; if it has replies, a
placeholder remains.

## Good to know

- A comment appears on the page itself after the next build (about 3 to 6 minutes
  with the defaults); in the widget it is there immediately.
- Remark42 limits how fast comments can be read and written (HTTP 429). The
  builder reads all comments with one request and waits and retries if limited.
- **Back up the Remark42 data** (volume `remark42-var`, see
  [Operations](/muffelblog/production/operations/)).
- The email addresses of commenters are held by you. Mention that in your privacy policy.
