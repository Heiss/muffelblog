---
title: '1. Prepare the sources'
description: Put a first post and two legal pages into a Nextcloud folder, share it, and write a first public memo.
---

This tutorial takes you from your own Nextcloud and Memos to a live blog with a
first post, a first memo, a moderated comment and a webmention that goes out. It
has four chapters; you can stop after each one.

1. **Prepare the sources** (this page): Nextcloud folder, share, first memo.
2. [Set up and publish](/muffelblog/tutorial/2-publish/): server, `.env`, start.
3. [Comments and moderation](/muffelblog/tutorial/3-comments/).
4. [Webmentions](/muffelblog/tutorial/4-webmentions/).

:::note[What was checked, and what was not]
The commands, variables and log lines in this tutorial come from the code of
the project, and the flows are tested in its CI. The steps **inside the user
interfaces of Nextcloud, Memos, your mail provider and webmention.rocks** are
described from their documentation. They have not been checked against a live
instance for this tutorial, and the labels differ between versions. If a step
does not match what you see, trust your interface and the intent of the step.
:::

## What you need

- A server with Docker and Docker Compose, and a **domain with two names**: one
  for the blog (`blog.example.org`) and one for the comments
  (`comments.example.org`).
- A Nextcloud where you can create a share link with a password.
- A Memos instance (reference version **26.11.0**) that the **server can reach**
  and that lets anyone read public memos without a login.
- A mailbox you can send from (SMTP), for the login mails of the comments.
- Your own reverse proxy (nginx, Caddy or Traefik) on that server. This tutorial
  uses the setup [Your own reverse proxy](/muffelblog/production/own-proxy/).

## 1. The Nextcloud folder

1. In Nextcloud, create an empty folder, for example `blog`.
2. Get the content of the
   [example folder](https://github.com/Heiss/muffelblog/tree/main/examples/nextcloud-folder)
   and upload it into `blog`. Upload the **content**, so that `hello-world.md`
   lies directly in `blog`, next to the folders `images`, `glossary` and
   `pages`. You can leave out `README.md`.
3. Open `pages/legal.md` and `pages/privacy.md` and replace every
   `[PLACEHOLDER]`. Check every `[CHECK: ...]` against your own setup.

:::caution[The legal pages are templates, not legal advice]
The builder does not check them: a placeholder that you leave in will be
published. For a private test that is fine. Before you tell anyone about the
blog, write your real texts, and ask a lawyer if you are unsure what your
country requires.
:::

4. Share the folder as a **public link**. Set a **password** (the builder
   refuses to start without one) and permission **read only**.
5. The link looks like `https://cloud.example.org/s/AbC123xyz`. The part after
   `/s/` is the **share token**. Write down the token and the password; you
   enter them in chapter 2.

**Check:** open the link in a private browser window, enter the password and
see `hello-world.md`, `images`, `glossary` and `pages`. This is exactly what the
builder will read. Background: [Connect Nextcloud](/muffelblog/guides/nextcloud/).

## 2. The first memo

1. In Memos, write a short note and add a tag in the text, for example
   `First memo from my new blog #welcome`.
2. Set its visibility to **Public**. Everything else is ignored by the builder.

The builder needs **no token** for Memos: it reads public memos like an
anonymous visitor. The only thing it needs is the address, `MEMOS_URL`, as the
**server** reaches it (not an address that only works in your home network).

**Check:** open your Memos address in a private browser window, without being
logged in. If you can read the memo there, the builder can read it too. If it
shows a login instead, change the access setting of the instance first; the
builder would stop with "The Memos instance requires a login". This check is
the author's reading of the Memos behaviour, not a test against every version.
Background: [Connect Memos](/muffelblog/guides/memos/).

## What you have now

| Thing           | Value you noted                                |
| --------------- | ---------------------------------------------- |
| `NEXTCLOUD_URL` | the address of your Nextcloud (without `/s/…`) |
| Share token     | the part after `/s/`                           |
| Share password  | the password you set                           |
| `MEMOS_URL`     | the address of your Memos instance             |

Next: [2. Set up and publish](/muffelblog/tutorial/2-publish/).
