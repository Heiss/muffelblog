---
title: Operations
description: Status, failure reports, backups, updates and rollback.
---

## Is it healthy?

The builder writes `state/status.json` (inside the volume `state`, mounted at
`/data/state`):

```sh
docker compose exec builder cat /data/state/status.json
```

```json
{
  "state": "ok",
  "lastCheck": "2026-11-04T10:03:00.000Z",
  "lastSuccess": { "id": "20261104T100000Z", "at": "2026-11-04T10:00:00.000Z" }
}
```

`"state": "failing"` adds `lastError` with the message and the time the failure
began. The log (`docker compose logs builder`) shows every build. The file
`build.json` on the site carries the id and time of the release that is online.

## Failure reports

Whatever fails (Nextcloud, Memos or Remark42 unreachable, a failed build), the
**last good version stays online**. The failure is written to the log and the
status file and, if you set `MUFFEL_ALERT_WEBHOOK`, sent to that URL as a POST:

```sh
MUFFEL_ALERT_WEBHOOK=https://ntfy.example.org/blog     # ntfy style: plain text, header "Title"
MUFFEL_ALERT_FORMAT=json                                # or: {"text": "..."} for Slack-compatible hooks
```

One message when a failure begins and one when it is over, not one per check. A
broken webhook never stops the builder.

## Timing

| Variable                        | Default | Effect                                                                                   |
| ------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| `MUFFEL_CHECK_INTERVAL_SECONDS` | 180     | How often the sources are checked                                                        |
| `MUFFEL_DEBOUNCE_CHECKS`        | 1       | How many further identical checks a change must survive before it is built (0 = at once) |
| `MUFFEL_RELEASES_KEPT`          | 3       | Releases kept on disk                                                                    |

With the defaults new content is online 3 to 6 minutes after your last edit. The
very first build starts at once.

## Backups

What is worth a backup:

| Data          | Where                                     | Why                                 |
| ------------- | ----------------------------------------- | ----------------------------------- |
| Remark42 data | volume `remark42-var`                     | the comments, **cannot be rebuilt** |
| `.env`        | the repository folder                     | the secrets                         |
| Caddy data    | volume `caddy-data` (only with our Caddy) | certificates                        |

Posts live in Nextcloud and memos in Memos, back those up there. Releases, the
Nextcloud cache and the state can be rebuilt. Remark42 also writes its own
daily backup into `var/backup` inside its volume; that is **not** a replacement
for a copy somewhere else. A tested backup and restore routine is not part of
the project yet.

## Updating

Releases are Git tags like `26.11.0` (year, month, counter). A tag runs the whole
test suite again and then publishes the builder image to the GitHub Container
Registry.

```sh
git pull
MUFFEL_VERSION=26.11.0 docker compose pull builder
MUFFEL_VERSION=26.11.0 docker compose up -d
```

Content updates need no release; the builder picks up changes by itself. Third
party images (Caddy, Remark42, Mailpit) are pinned to versions; take a backup of
`remark42-var` before changing the Remark42 version.

**Rollback:** start the previous tag. The released site in `releases/` stays as
it is; to switch back to an older built site by hand, point the link `current`
to an older folder (`ln -sfn <id> releases/current` inside the releases folder).

## Settings that stop the builder at the start

Wrong or missing settings are errors at start, not surprises later: an invalid
number, `NEXTCLOUD_URL` with an empty password, `NEXTCLOUD_URL` together with
`MUFFEL_FIXTURES`, a missing `MEMOS_URL`, a webhook address that is no URL. Read
`docker compose logs builder` after a change.
