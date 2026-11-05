---
title: Statistics
description: Count visits with your own Matomo instance, without cookies. Off by default.
---

The blog has no statistics of its own. If you run a
[Matomo](https://matomo.org) instance, the blog can report page views to it.

:::caution[Off by default]
A fresh instance counts nothing and talks to no one. With Matomo switched on,
every visitor's browser contacts your Matomo server. Mention it in your privacy
policy (the template of the example folder has a section for it).
:::

## Switch it on

In `.env`:

```sh
MATOMO_URL=https://stats.example.org     # or https://example.org/matomo/
MATOMO_SITE_ID=3                         # the id of this site in Matomo
```

Then `docker compose up -d`. The setting takes effect with the next build of
the site (after the next change of your content, or right away when the builder
starts).

- `MATOMO_URL` is the address of your Matomo: an origin, or a path that ends
  with `/`. The blog loads `matomo.js` from there and sends to `matomo.php`.
- The Content Security Policy of the blog allows exactly this address for
  scripts, requests and the tracking image; nothing else.
- Cookies are **off** (`disableCookies`): Matomo cannot follow a visitor across
  visits. Whether you need a consent banner depends on your country and on your
  Matomo settings; the blog does not show one.
- Setting only one of the two variables, or an invalid address, stops the build
  with a message.

If your reverse proxy serves the files itself
([Proxy serves the files](/muffelblog/production/host-folder/)), add the Matomo
address to `script-src`, `connect-src` and `img-src` of your Content Security
Policy yourself.

Not tested against a real Matomo instance: the project tests the settings, the
page markup and the policy, not the counting itself.
