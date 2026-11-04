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

| Data              | Where                                     | Why                   |
| ----------------- | ----------------------------------------- | --------------------- |
| Remark42 comments | volume `remark42-var`                     | **cannot be rebuilt** |
| `.env`            | the repository folder                     | the secrets           |
| Caddy data        | volume `caddy-data` (only with our Caddy) | certificates          |

Posts live in Nextcloud and memos in Memos, back those up there. Releases, the
Nextcloud cache and the state can be rebuilt.

```sh
docker/backup.sh /srv/backups          # writes muffelblog-<time>.tar.gz
docker/restore.sh /srv/backups/muffelblog-20261104T100000Z.tar.gz
```

`backup.sh` asks Remark42 for its official export and packs it together with
`.env`. The file contains your **secrets**: it is created readable by you only,
keep it that way and copy it to another machine; a backup on the same disk is not
one. `restore.sh` puts the comments back (Remark42 replaces the comments of the
site with those of the backup); the old `.env` inside the file is not applied
automatically. CI runs the whole cycle on every change: write a comment, back up,
delete the comment, restore, see it on the page again.

Remark42 also writes its own daily export into `var/backup` inside its volume.
That is the same kind of file, but on the same disk.

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
