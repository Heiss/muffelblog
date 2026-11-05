---
title: Webmentions
description: Send webmentions to the sites you link to and receive mentions of your posts through webmention.io. Both off by default.
---

A [webmention](https://www.w3.org/TR/webmention/) is a small message from one
site to another: "my page _source_ links to your page _target_". Muffelblog can
**send** them, and it can **receive** them through
[webmention.io](https://webmention.io): a received mention appears as a comment
under the post. Both are off by default.

:::caution[Off by default]
A fresh instance does not talk to the outside world. Sending webmentions makes
the builder contact the sites you link to, so you switch it on yourself.
:::

## Switch it on

Set in `.env` and recreate the builder (`docker compose up -d`):

```sh
SITE_URL=https://blog.example        # required: the address of your blog
MUFFEL_WEBMENTIONS_SEND=1
```

Without `SITE_URL` the builder refuses to start: a mention needs an absolute
address for the source.

## What is sent, and when

- **Which entries:** posts, memos and terms.
- **Which links:** every external `http(s)` link in the content of the entry,
  except your own host and the hosts in `MUFFEL_WEBMENTIONS_BLOCK`. At most 10
  per entry (`MUFFEL_WEBMENTIONS_MAX_TARGETS`).
- **When:** after a new release is online. The builder reads the **built
  pages**, so it sends exactly what the receiver will fetch.
- **First start:** the entries that exist when you switch it on are stored as
  "already sent". Nothing goes out. Only new and changed entries are sent
  afterwards. To send the existing entries on purpose:
  `docker/webmentions.sh send-existing`.
- **Changed entry:** sent again to all its links. A link that you removed gets
  the message once more, so the other site can see that the link is gone.
- **Removed entry:** its links get the message once more.

## How a message goes out

1. The builder fetches the target page and looks for the endpoint: first the
   HTTP `Link` header, then `<link rel="webmention">` or `<a rel="webmention">`.
2. If there is one, it sends a `POST` with `source` and `target`. Any `2xx`
   answer counts as sent.
3. If there is none, nothing is sent. The host is not asked again for 30 days
   (`MUFFEL_WEBMENTIONS_NO_ENDPOINT_DAYS`). A found endpoint is reused for 7 days.
   Timeouts and server errors are not remembered.

A failed message is tried again after later builds, up to 3 times
(`MUFFEL_WEBMENTIONS_ATTEMPTS`), then given up. A given-up message goes to the
alert webhook, if you have one (`MUFFEL_ALERT_WEBHOOK`). A failure never fails a
build.

## Safety of the requests

The builder fetches addresses that come from your content, so it is careful:

- Only `http` and `https`, no user name or password in the address.
- The host name is resolved and **every** address must be public. Loopback,
  private, link-local, carrier-grade NAT and metadata addresses are refused,
  also inside IPv4-mapped IPv6 addresses.
- The connection goes to exactly the address that was checked (no second look-up).
- At most 10 seconds and 1 MB per request, at most 3 redirects (each checked
  again), one request per second.

## See what happened

```sh
docker/webmentions.sh list
```

shows every pair with time, status (`sent`, `failed`, `given-up`,
`no-endpoint`) and error. The same totals are in `state/status.json` under
`webmentions`. The builder log has one line for each message.

## Test it without a real receiver

The project has a tiny local receiver, so you can see the message that goes
out. Public webmention receivers need a public address, local ones are refused
by the address check, so for this test you lift that check **temporarily**:

```sh
# .env
MUFFEL_WEBMENTIONS_SEND=1
MUFFEL_WEBMENTIONS_ALLOW_PRIVATE=1     # only for this test, remove it afterwards
```

Start the receiver inside the builder container:

```sh
docker compose exec builder node /repo/docker/webmention-receiver.mjs
```

It listens on port 9000, offers an endpoint and prints every message it gets.
Then write a post or memo with a link to `http://localhost:9000/hello`. After
the next build the receiver prints:

```text
webmention received: source="https://blog.example/p/my-post/" target="http://localhost:9000/hello"
```

Remove `MUFFEL_WEBMENTIONS_ALLOW_PRIVATE` afterwards.

## Receive mentions

Other sites send their mentions to [webmention.io](https://webmention.io), a
free service that keeps them for you. The builder asks it at every check and
writes each new mention into the comments of the page, as a comment of the
administrator:

```text
Reply from Ada Lovelace: https://ada.example/notes/1
```

The kind (mention, reply, like, repost, bookmark, RSVP) and the author come
from webmention.io; the time is the time the builder wrote it (Remark42 does not
allow another one). No text and no picture of the other site are taken over.

:::caution[Off by default]
With receiving on, the builder contacts webmention.io every few minutes, and
every page announces webmention.io as its endpoint. Mention it in your privacy
policy.
:::

### Set it up

1. Put links to your profiles on the blog, so webmention.io can confirm that the
   site is yours (IndieAuth with `rel=me`), for example your GitHub profile or
   your mail address:

   ```sh
   MUFFEL_REL_ME=https://github.com/you,mailto:you@example.org
   ```

   `docker compose up -d`, wait for the next build.

2. Sign in at webmention.io with the address of your blog and copy your **API
   token** from the settings there.
3. In `.env`:

   ```sh
   MUFFEL_WEBMENTIONS_RECEIVE=1
   WEBMENTION_IO_TOKEN=the-token-from-webmention.io
   ```

   `docker compose up -d`. Every page now announces
   `https://webmention.io/<your host>/webmention`.

The builder uses the administrator login of Remark42 (`REMARK_ADMIN_PASSWD`) to
write the comments; it needs `SITE_URL` and the comments (`COMMENTS_URL`).

- **Only posts, memos and terms** get mentions; a mention of another page is
  ignored.
- **Never twice:** the builder remembers what it posted
  (`state/webmentions-received.json`). If that file is lost, it reads the
  existing comments of the administrator from Remark42 first.
- **Deleted mentions:** when webmention.io removes a mention (the other site
  removed the link, or you deleted it there), the comment is deleted as well.
- **webmention.io down:** existing mentions stay; the next check tries again.

Steps 1 and 2 happen on webmention.io and are described from its
documentation; they were not checked against the live service.

### Try it without a domain

The demo (`docker/init-env.sh --demo`) runs a stand-in of webmention.io
(`docker/webmention-io-standin.mjs`) on `http://localhost:8090`, with receiving
switched on. Send it a mention of a demo post:

```sh
curl -X POST -H 'Content-Type: application/json' \
  -d '{"source":"https://example.org/my-post","target":"http://localhost:8080/p/<slug>/","property":"in-reply-to","author":"Me"}' \
  http://localhost:8090/_standin/mention
```

Within a few checks the comment is under the post. `docker/webmention-receive-flow.sh`
does the whole round, including the deletion; CI runs it. The stand-in does
not check that the source really links to the target, as webmention.io does.
