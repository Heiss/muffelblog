---
title: Runbook for disruptions
description: What to do when a source is unreachable, a build breaks, a release has to be rolled back, the disk is full, mail does not arrive, the domain changes or a secret leaks.
---

Start with the state:

```sh
docker compose ps
docker compose logs --tail 50 builder
docker compose exec builder cat /data/state/status.json
```

With your own files, set them first, for example
`export COMPOSE_FILE=compose.yaml:compose.production.yaml`. Whatever fails, the
**last good version stays online**; the visitors do not see a disruption of a
source or of the builder.

## A source is not reachable

| Log or status says                                          | What it means and what to do                                                                                                                                                                                      |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nextcloud: the share is empty, or a login or download error | Open the share link in a private window. A wrong password or token, a deleted share, or a Nextcloud that is down. Fix the value in `.env` and `docker compose up -d`.                                             |
| Memos: "requires a login"                                   | The instance does not allow anonymous reading of public memos. Change that in Memos.                                                                                                                              |
| Memos or Remark42 unreachable or time out                   | Check that the address in `MEMOS_URL` (or `REMARK_INTERNAL_URL`) works **from the builder container**: `docker compose exec builder node -e "fetch(process.argv[1]).then(r => console.log(r.status))" <address>`. |
| Remark42: HTTP 429                                          | Rate limit. The builder waits and retries by itself; if it lasts, a proxy in front of Remark42 does not set `X-Real-IP` ([own proxy](/muffelblog/production/own-proxy/)).                                         |

A failure is reported once when it begins and once when it is over (log, status
file and, if you set one, `MUFFEL_ALERT_WEBHOOK`). The builder checks again
every `MUFFEL_CHECK_INTERVAL_SECONDS`, no restart is needed.

## The build is broken

`"state": "failing"` with a build error in the log. Common causes:

- **The error names a file of yours.** Fix or remove that file in Nextcloud; the
  next check builds again. (Invalid frontmatter alone does not fail a build: that
  file is skipped with a warning.)
- **Invalid settings.** The builder lists every wrong variable with its range
  and stops at the start. `MUFFEL_FIXTURES` must be empty when `NEXTCLOUD_URL` is
  set. `MUFFEL_WEBMENTIONS_SEND=1` needs `SITE_URL`.
- **Out of memory or disk during the build.** See below.

To force a new build without changing content:

```sh
docker compose exec builder rm /data/state/scheduler.json
```

At the next check the builder sees a change and builds (after one more equal
check).

## Roll back to an older release

The builder keeps the newest `MUFFEL_RELEASES_KEPT` releases (default 3). The
folder `current` is a link to the one that is online. Switch it atomically
(on the host folder with your own proxy, use `sudo -u '#1000'` or `sudo`, because
the folder belongs to uid 1000; otherwise inside the volume):

```sh
cd /srv/muffelblog/releases        # your MUFFEL_RELEASES_DIR
ls                                  # the release ids, newest last
ln -s 20261104T100000Z current.new
mv -T current.new current
```

The old release is online at once. The builder does not undo it: it builds again
when the content changes. If a bad file is the cause, remove it first, otherwise
the next build is broken again.

## The builder says a folder is not writable

The builder runs as the user `node` (uid 1000), not as root. A volume or a host
folder that an **older version** created belongs to root, and the builder stops
at the start and names the folder. Repair the owner once:

```sh
# the Docker volumes (releases, cache, state)
docker compose run --rm --no-deps --user root --entrypoint chown builder \
  -R 1000:1000 /data/releases /data/cache /data/state
# the folder of your own proxy (MUFFEL_RELEASES_DIR)
sudo chown -R 1000:1000 /srv/muffelblog/releases
```

Then `docker compose up -d` again. Your proxy keeps reading the folder as before.

## The disk is full

```sh
df -h
docker system df
```

Each release is a complete copy of the site (images included). Lower
`MUFFEL_RELEASES_KEPT` (not below 1; open browser tabs still load the assets of
the release they came from, so keep at least 2 or 3 on a busy blog), and remove
unused images with `docker image prune`. Do **not** delete the volume
`remark42-var` (the comments) and keep `.env`.

## Login mails do not arrive

1. Does Remark42 send? `docker compose logs remark42 | tail`.
2. Check `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`,
   `SMTP_TLS` with your provider (port and encryption differ).
3. Mails from your domain land in the spam folder without SPF, DKIM and DMARC
   records. Your mail provider says which records to set.

## The comments server is down

The pages stay readable: the comments are also in the HTML (the static copy from
the last build). Only the widget fails, with its own message. Restart it with
`docker compose up -d remark42`. The data is in the volume `remark42-var`;
a backup is `docker/backup.sh`, restoring is for an **empty** Remark42
([Operations](/muffelblog/production/operations/)).

## The domain changes

`SITE_URL` is part of the address of every comment: Remark42 keys comments by the
address of the page. Plan it before you switch.

1. Change `SITE_URL`, `COMMENTS_URL` (and `SITE_ADDRESS`, `COMMENTS_ADDRESS`
   with our Caddy) in `.env`, update your proxy and DNS, `docker compose up -d`.
2. Comments of the old address do not show on the new pages. Remark42 has an
   administrator function to move comments to new addresses; the project does not
   wrap it and has not tested it. Read the Remark42 documentation before you try
   it, and make a backup first (`docker/backup.sh`).
3. Webmentions that you sent carry the old address as the source. They are not
   moved. After the change the sender stores your entries under the new address
   **without sending** (like at the first start, the log says so), so no flood of
   messages goes out. Only new and changed entries are sent from then on;
   `docker/webmentions.sh send-existing` sends the existing ones on purpose.
4. Keep redirects from the old domain at your proxy for as long as you can.

## A secret has leaked

| Secret                            | What to do                                                                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Nextcloud share password or token | Delete the share link in Nextcloud, create a new one with a new password, set `NEXTCLOUD_SHARE_PASSWORD` and `NEXTCLOUD_SHARE_TOKEN`, `up -d`. |
| `SMTP_PASSWORD`                   | Change it at your mail provider, then in `.env`, `docker compose up -d remark42`.                                                              |
| `REMARK_ADMIN_PASSWD`             | New random value in `.env`, `docker compose up -d`. It is only used inside the Docker network and by `docker/moderate.sh`.                     |
| `REMARK_SECRET`                   | New random value in `.env`, `docker compose up -d remark42`. It signs the logins: everybody is logged out once.                                |
| `MUFFEL_ALERT_WEBHOOK`            | Create a new URL at the service and replace it in `.env`.                                                                                      |

A new random value: `head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'`. A
backup file made with `docker/backup.sh` contains `.env`; if that file leaked,
rotate everything above.

## Last resort: start again from the sources

Releases, the Nextcloud cache and the state can be rebuilt from Nextcloud and
Memos. Only the comments cannot. After a backup of `remark42-var` and `.env`:

```sh
docker compose down            # keeps the volumes
docker compose up -d --build
```

`docker compose down --volumes` deletes **all** volumes, including the comments.
