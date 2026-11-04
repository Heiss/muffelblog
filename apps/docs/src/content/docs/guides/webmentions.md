---
title: Webmentions
description: Tell other sites that you linked to them. Off by default, how it works, how to switch it on and how to test it.
---

A [webmention](https://www.w3.org/TR/webmention/) is a small message from one
site to another: "my page _source_ links to your page _target_". Muffelblog can
**send** them. Receiving mentions is not built yet.

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

The tutorial uses a tiny local receiver, so you can see the message that goes
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
webmention received: source=https://blog.example/p/my-post/ target=http://localhost:9000/hello
```

Remove `MUFFEL_WEBMENTIONS_ALLOW_PRIVATE` afterwards.
