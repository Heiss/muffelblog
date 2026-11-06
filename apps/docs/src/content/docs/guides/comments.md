---
title: Comments
description: Self-hosted comments with Remark42, login by email, moderation and the static copy.
---

Posts, memos and glossary terms have a comment section. It is [Remark42](https://remark42.com),
running next to the blog; you do not need an account anywhere else.

## How it works for readers

- Login is **by email only** (a link in a mail). No anonymous comments, no social logins.
- The comment widget loads from **your own** comments host, never from a third party.
- The comments are also written into the page HTML at build time, sanitized, so
  they read without JavaScript and search engines see them. When the widget has
  loaded, the static copy steps aside.

## Close comments for one Markdown page

Add a boolean to the frontmatter of a post or glossary term:

```yaml
comments: false
```

After the next build, the page shows a closed notice and keeps the existing
static comments readable. It does not load the posting widget. Omit the field
or use `comments: true` to restore the widget. Quoted values such as `"false"`
are invalid and produce a build warning; use a YAML boolean.

This setting controls the blog page, and does not change Remark42's server
settings. To reject new comments at the Remark42 server too, use the
administrator control described below. Memos do not have Markdown frontmatter;
close their discussions through Remark42.

## Settings

| Variable                                                                            | Meaning                                                                                                                                                          |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REMARK_SECRET`, `REMARK_ADMIN_PASSWD`                                              | Required secrets (created by `docker/init-env.sh`)                                                                                                               |
| `COMMENTS_URL`                                                                      | The address of the comments host **as the browser sees it**, for example `https://comments.example.org`. The Content Security Policy allows exactly this origin. |
| `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_TLS` | The mail server for the login mails                                                                                                                              |
| `SITE_URL`                                                                          | Required for the static copy: the address of a page is the key of its comments                                                                                   |

You set a real SMTP server (for example Migadu: host `smtp.migadu.com`, a
mailbox of your domain as sender; check the port and encryption in your
provider's settings). In the local demo the login mails go to **Mailpit**
(http://localhost:8025) and nothing leaves your machine.

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
password never crosses the network. The deleted comment leaves the page at the
next build.

### In the Remark42 interface

Remark42 **1.18.0** grants web interface privileges by **user ID**, not by the
notification email alone:

| Muffelblog setting    | Remark42 setting     | Role                                                                                                 |
| --------------------- | -------------------- | ---------------------------------------------------------------------------------------------------- |
| `REMARK_ADMIN_EMAIL`  | `ADMIN_SHARED_EMAIL` | Administrator notification/contact address. It does not by itself grant UI privileges.               |
| `REMARK_ADMIN_ID`     | `ADMIN_SHARED_ID`    | Exact authenticated user ID (including its provider prefix); grants the UI controls.                 |
| `REMARK_ADMIN_PASSWD` | `ADMIN_PASSWD`       | Secret for internal Basic-auth scripts, backups and webmention import; not the email-login password. |

1. Log in with your intended email through the widget. In the local demo use
   `admin@localhost` and read the login mail in Mailpit. New demo environments
   include that user's ID automatically; existing `.env` files are not overwritten.
2. In your browser's developer tools, inspect the authenticated **response body**
   for `GET /api/v1/user` on the comments host. Copy its `id` and check the user
   name and `admin` flag. Do not copy cookies, JWTs or authorization headers
   into chat or documentation. This ID is more authoritative than guessing it
   from the address. For the pinned email provider it is `email_` followed by a
   SHA-1 digest of the identity address; provider/normalization differences make
   the actual signed-in ID the reliable choice.
3. Put that ID in your local `.env` as `REMARK_ADMIN_ID=...` (retain the provider
   prefix). The default Compose file passes it to `ADMIN_SHARED_ID`. If you use
   a locally customized Compose file, add that mapping there too.
4. Recreate **Remark42 only**, then sign out and back in to refresh the login:

   ```sh
   docker compose config --quiet
   docker compose up -d --no-deps --force-recreate remark42
   ```

Expected: the authenticated response has `admin: true`, and the interface shows
**Show settings**, **Disable comments** and moderation controls. If email login
works but these are missing, check the ID mapping and reauthenticate. Do not
reset comment data or change SMTP to repair a privileges problem. Verify these
names against the actual Remark42 image if you upgrade it.

As an administrator, use **Disable comments** for the current page to close
new comments while keeping the discussion readable. **Enable comments** opens
it again. This is a per-page server setting, enforced by Remark42, and takes
effect without a blog rebuild. The widget follows this setting whenever it
loads; normal blog builds do not reset it. These controls were verified in the
Remark42 1.18.0 source; administrator clicks are not covered by the project's
browser tests.

The two controls are independent: `comments: false` keeps the posting widget off
even if Remark42 is open. Removing the Markdown setting does not reopen a
server-closed discussion. Remove the setting and then use **Enable comments**
in the widget if you want to reopen both.

### Notification

Every new comment is mailed to the administrator (`NOTIFY_ADMINS=email`, with
`MAIL_FROM` as sender). In the demo the mail lands in Mailpit.

## Good to know

- A comment appears on the page itself after the next build (about 3 to 6 minutes
  with the defaults); in the widget it is there immediately.
- Remark42 limits how fast comments can be read and written (HTTP 429). The
  builder reads all comments with one request and waits and retries if limited.
- **Back up the Remark42 data** (volume `remark42-var`, see
  [Operations](/muffelblog/production/operations/)).
- The email addresses of commenters are held by you. Mention that in your privacy policy.
