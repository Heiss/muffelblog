---
type: Policy
title: Defaults stay inside
description: A fresh instance does not talk to the outside world. Everything that does is off until the owner switches it on.
tags: [defaults, privacy, outbound, configuration]
status: draft
generated: { by: claude-code/web, at: 2026-11-04T19:00:00Z }
---

# Decisions

* **[E]** The default of every setting is the one that keeps the instance to
  itself. A feature that sends something to a third party, or that contacts a
  server the owner did not name, is **off** until the owner turns it on with an
  environment variable (decided by the owner, 2026-11-04).
* **[E]** Not covered by the rule, because the owner configures them on purpose
  and the instance does nothing without them: the sources (`NEXTCLOUD_URL`,
  `MEMOS_URL`), Remark42 and its mail server (`SMTP_*`), the optional alert
  webhook (`MUFFEL_ALERT_WEBHOOK`, empty by default).
* **[E]** Sending webmentions (W15) is off by default (`MUFFEL_WEBMENTIONS_SEND`).
* **[E]** Every new feature states its default in the pull request and in the
  configuration reference. A test checks the default if the feature can reach
  the network.

# Known cases

* The build contacts no third party: images, fonts and scripts are delivered
  from the own domain; embeds (YouTube) load only after a click and only from
  the allowlist ([Sanitizing](/security/sanitization.md)).
* **[U]** Whether the Compose demo should keep the Mailpit mail sink as the
  default, so no login mail leaves the machine. Today it does.
