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

## Monitoring from outside

The same information is public at `https://blog.example.org/health.json`, so an
uptime monitor or an automation can read it without access to the server:

```json
{
  "state": "ok",
  "generatedAt": "2026-11-04T10:03:05.000Z",
  "lastCheck": "2026-11-04T10:03:00.000Z",
  "lastSuccess": { "id": "20261104T100000Z", "at": "2026-11-04T10:00:00.000Z" },
  "checkIntervalSeconds": 180
}
```

| Field                  | Meaning                                                                      |
| ---------------------- | ---------------------------------------------------------------------------- |
| `state`                | `ok`, or `failing` when the last check or build failed                       |
| `lastCheck`            | When the builder last looked at its sources                                  |
| `lastSuccess`          | The release that is online (id) and when it was built                        |
| `failingSince`         | Only while failing: since when                                               |
| `checkIntervalSeconds` | How often the builder checks, so a monitor can tell when the data is too old |
| `generatedAt`          | When the file was written                                                    |

The builder rewrites the file at **every check**, inside the release that is
online. It contains **no error text** (that can hold internal addresses); read
the reason from `state/status.json` or the log.

If the search index fails, the release still goes online, only without search.
`state/status.json` then has `"search": { "state": "failed", "message": ... }`,
and the alert webhook reports it once ("online without search"). On a CPU
without AVX the message names the image variant `noavx`.

:::caution[A static file cannot say "dead"]
The file is served like any other page, so the HTTP status is `200` also when
`state` is `failing`, and when the builder has stopped the file just stays as it
was. A monitor therefore has to look at the content: `state` **and** the age of
`lastCheck`. A check that works in cron, Healthchecks-style scripts or most
automation tools (needs `jq`):

```sh
curl -fsS https://blog.example.org/health.json | jq -e '
  .state == "ok" and
  ((now - (.lastCheck | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601)) < (.checkIntervalSeconds * 3))'
```

It exits with `0` when all is well and `1` otherwise. The factor 3 leaves room
for a build that takes a few minutes. Before the first release is online the
file does not exist (`404`).
:::

To be **told** instead of asking, use the alert webhook below: it sends a message
when a failure begins and when it is over, and you can build automations on it.
`/health.json` is for polling, the webhook is for pushing.

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

Posts live in Nextcloud and memos in Memos, back those up there. Releases and the Nextcloud cache can be rebuilt. Preserve the state volume too:
it contains the scheduler marker and webmention send/receive progress. Do not
clear it to request a rebuild; use `docker/rebuild.sh` as described in the
[runbook](/muffelblog/production/runbook/#a-changed-setting-is-absent-from-the-public-site).

```sh
docker/backup.sh /srv/backups          # writes muffelblog-<time>.tar.gz
docker/restore.sh /srv/backups/muffelblog-20261104T100000Z.tar.gz
```

`backup.sh` asks Remark42 for its official export and packs it together with
`.env`. The file contains your **secrets**: it is created readable by you only,
keep it that way and copy it to another machine; a backup on the same disk is not
one. `restore.sh` imports the comments into an **empty** Remark42, as after a lost
disk. Remark42 refuses comment ids it already knows, also deleted ones, so
importing into a running site does not bring a deleted comment back. The old
`.env` inside the file is not applied automatically. CI runs this cycle on every
change: write a comment, back up, delete it, wipe the Remark42 data, restore, see
the comment on the page again.

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
