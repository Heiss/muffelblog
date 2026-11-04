---
title: '4. Webmentions'
description: Switch on sending, write a post that links to a receiver, and watch the message go out.
---

A [webmention](/muffelblog/guides/webmentions/) tells another site that you
linked to it. Your blog can **send** them. Receiving is not built yet, so
mentions of your posts on other sites do not show up on your blog. What you can
test is the message that goes out.

:::caution[It talks to other servers]
Sending is **off by default**. When you switch it on, the builder contacts the
sites you link to and tells them the address of your post. Do that only on
purpose, and mention it in your privacy policy (the template has a section for
it).
:::

## 1. Switch it on

In `.env` (`SITE_URL` is already there from chapter 2):

```sh
MUFFEL_WEBMENTIONS_SEND=1
```

Recreate the builder and look at the log:

```sh
docker compose -f compose.yaml -f compose.production.yaml up -d
docker compose logs builder | grep webmentions
```

```text
[builder] webmentions: first start, 3 existing entries are stored as already sent (nothing is sent)
```

At the first start the entries that exist are stored as "already sent". Nothing
goes out. Only new and changed entries are sent from now on.

```sh
export COMPOSE_FILE=compose.yaml:compose.production.yaml
docker/webmentions.sh list
```

prints `0 pairs, 3 entries known` (the number is your count of posts, memos and
terms).

## 2. Write a post that links to a receiver

You need a page on another site that advertises a webmention endpoint. A public
test receiver is the safest choice, because nobody is surprised by a mention
from you. This tutorial uses **webmention.rocks**, a test site for webmention
senders, and its test pages, for example `https://webmention.rocks/test/1`.

:::note[Not checked]
The author could not reach webmention.rocks while writing this tutorial. That
the site is what it is described as here, which test pages exist, and what it
shows after a mention are **not verified**: look at the site, and pick a test
page that it offers. Any other page that advertises an endpoint works the same
way. Your own log is the proof that the message went out; see step 3.
:::

In Nextcloud, add a new file `second-post.md` to your folder:

```markdown
---
publish: true
title: A post that links to a test receiver
date: 2026-11-05 10:00
tags: [indieweb]
description: A second post to test sending webmentions.
---

Today I try [a webmention test page](https://webmention.rocks/test/1) from my
own blog.
```

Replace the date with today's date and the link with the test page you picked.

## 3. Watch it go out

Wait for the next build (3 to 6 minutes), then:

```sh
docker compose logs builder | grep webmention
docker/webmentions.sh list
```

The log shows one line for the message:

```text
[builder] webmention sent (new): https://blog.example.org/p/second-post/ -> https://webmention.rocks/test/1 (HTTP 201)
```

The status after `->` is the answer of the receiver; any `2xx` counts as sent.
`list` shows the pair with the time and the status `sent`. The same totals are
in `state/status.json` under `webmentions`.

What else you may see:

| Status in `list` | Meaning                                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `no-endpoint`    | The page you linked does not advertise a webmention endpoint. Nothing is sent. The host is not asked again for 30 days. |
| `failed`         | The message did not go through. It is tried again after later builds, up to 3 tries.                                    |
| `given-up`       | All tries failed. It goes to your alert webhook if you set one (`MUFFEL_ALERT_WEBHOOK`).                                |

The receiver checks that your page really links to its page (it fetches your
post), so your blog must be reachable from the internet for a real receiver to
accept the mention.

## 4. Change and remove

- Edit the post: the message goes out again to all its links.
- Remove the link from the post, or delete the post: the same message goes to
  that page once more, so the other site can see that the link is gone.

## 5. Keep it under control

| Variable                         | Default | Effect                                                                  |
| -------------------------------- | ------- | ----------------------------------------------------------------------- |
| `MUFFEL_WEBMENTIONS_SEND`        | `0`     | The switch. Remove it or set `0` to stop sending.                       |
| `MUFFEL_WEBMENTIONS_BLOCK`       | empty   | Hosts that are never asked, for example `example.org,news.example.com`. |
| `MUFFEL_WEBMENTIONS_MAX_TARGETS` | 10      | Links of one entry that are reported.                                   |

The builder only talks to **public** addresses; private and local ones are
refused. All settings and the safety rules are in the
[Webmentions guide](/muffelblog/guides/webmentions/) and the
[Configuration](/muffelblog/reference/configuration/) reference.

## Where you are

You followed the whole way: a Nextcloud folder with a post, a glossary entry and
legal pages, a Memos note, a blog that publishes both, a comment that you
moderated, and a webmention that went out. To change the setup later, the pages
under **Production** and **Reference** cover everything the tutorial left out.
