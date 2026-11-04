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

Two ways, both with the administrator login.

### On the command line (tested in CI)

```sh
docker/moderate.sh list 20                        # latest comments: id, time, author, user id, page
docker/moderate.sh delete <comment-id> <page-url> # delete one comment
docker/moderate.sh block <user-id> 7d             # block a user for 7 days (without 7d: permanent)
docker/moderate.sh unblock <user-id>
```

It runs inside the builder container with `REMARK_ADMIN_PASSWD` from `.env`, so the
password never crosses the network. With a production override set the files first,
for example `COMPOSE_FILE=compose.yaml:compose.production.yaml`. The deleted
comment leaves the page at the next build.

### In the Remark42 interface

Set `REMARK_ADMIN_EMAIL` in `.env`. Whoever logs in **with this address by email**
is the administrator and sees delete and block buttons on every comment. In the
local demo the default is `admin@localhost`; read the login mail in Mailpit.
In production this variable is **required**: Remark42's own default would be
`admin@<your comments host>`, a guessable address.

This follows the Remark42 documentation; the clicks in the interface are not
covered by the project's tests (the command line is).

### Notification

Every new comment is mailed to the administrator (`NOTIFY_ADMINS=email`, with
`MAIL_FROM` as sender). Locally the mail lands in Mailpit.

## Good to know

- A comment appears on the page itself after the next build (about 3 to 6 minutes
  with the defaults); in the widget it is there immediately.
- Remark42 limits how fast comments can be read and written (HTTP 429). The
  builder reads all comments with one request and waits and retries if limited.
- **Back up the Remark42 data** (volume `remark42-var`, see
  [Operations](/muffelblog/production/operations/)).
- The email addresses of commenters are held by you. Mention that in your privacy policy.
