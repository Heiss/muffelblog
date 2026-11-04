---
title: '3. Comments and moderation'
description: Write the first comment as a reader, see the mail that the administrator gets, and delete or block as the administrator.
---

The blog is online ([chapter 2](/muffelblog/tutorial/2-publish/)). Now the first
comment.

:::note[How moderation works here]
A comment appears **at once**, without approval. Moderation happens afterwards:
you get a mail about every new comment, and you can delete a comment or block
its author. Nobody can comment without logging in by email.
:::

## 1. Write the first comment as a reader

1. Open the post **Hello, world** on your blog and scroll to the comments.
2. Choose to log in with **email**, enter a name and an email address that you
   can read.
3. The mail from `MAIL_FROM` (subject "remark42 confirmation") contains a
   **token**. Copy it into the token field of the comments widget, as the mail
   says.
4. Write a comment and send it.

The comment is in the widget immediately. It becomes part of the page itself
(visible without JavaScript, and for search engines) at the next build, 3 to 6
minutes later; the widget then steps aside for that copy.

The exact labels of the widget belong to Remark42 and may differ in your
version. The flow itself (login by email, a token in the mail) is what the
project's CI runs against a real Remark42.

**Check:** reload the page after a few minutes with JavaScript off, or look at the
page source: your comment is in the HTML.

## 2. The administrator gets a mail

Every new comment is mailed to `REMARK_ADMIN_EMAIL` (subject "New comment to
your site"). Look into that mailbox. If nothing arrives, check the SMTP values in
`.env` and `docker compose logs remark42`.

## 3. Moderate as the administrator

### In the browser

Log in to the comments widget **with the address in `REMARK_ADMIN_EMAIL`**, the
same way as in step 1. On every comment you now see buttons to delete and to
block. This follows the Remark42 documentation; the clicks are not covered by
the project's tests.

### On the command line

This is tested in CI and needs no browser. Tell Compose which files you use,
once per shell:

```sh
export COMPOSE_FILE=compose.yaml:compose.production.yaml
docker/moderate.sh list 20
```

prints the latest comments with the comment id, the time, the author, the user id
and the page. Then:

```sh
docker/moderate.sh delete <comment-id> <page-url>   # a comment leaves the page at the next build
docker/moderate.sh block <user-id> 7d               # block for 7 days; without 7d: permanent
docker/moderate.sh unblock <user-id>
```

A blocked reader cannot write comments any more. The password of the
administrator account (`REMARK_ADMIN_PASSWD`) never leaves the server: the
script runs inside the builder container.

**Check:** delete your test comment with `delete`, wait for the next build, and
see that it is gone from the page.

## 4. Back up the comments

The comments exist only in Remark42. They cannot be rebuilt from Nextcloud.

```sh
docker/backup.sh /srv/backups
```

writes a file `muffelblog-<time>.tar.gz`. It contains your **secrets** (`.env`),
so copy it to another machine and keep it private. Restoring works into an
**empty** Remark42, as after a lost disk (`docker/restore.sh <file>`); it does
not bring a deleted comment back into a running one. Details:
[Operations](/muffelblog/production/operations/).

Next: [4. Webmentions](/muffelblog/tutorial/4-webmentions/).
