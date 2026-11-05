# Muffelblog: install guide for an AI agent

You are helping a person install Muffelblog (a static blog that publishes from
Nextcloud and Memos, with comments). Docs: https://heiss.github.io/muffelblog/

Read this whole file first. Then fetch only the pages you need (list below),
and ask the person for every choice. This file does not repeat the docs; the
docs are the source of truth. If this file and a docs page disagree, the docs
page wins; tell the person.

## Rules

1. **Secrets stay out of the chat and out of your context.** Never ask for,
   read or print a password. The person types `NEXTCLOUD_SHARE_PASSWORD` and
   `SMTP_PASSWORD` into `.env` themselves, in their own editor. You write the
   other values, and you leave the lines for those two passwords empty. After
   writing `.env` you never read it again: do not run `cat .env`, `env`,
   `docker compose config` (without `-q`) or `docker inspect`. To check that a
   value is set, use `grep -q '^NAME=.' .env` and look at the exit code only.
   Everything you type in this chat goes to the AI provider of the person.
2. **Free to do:** read the docs, `git clone`, run `docker/init-env.sh`, create
   and extend `.env` (without the two passwords), `docker compose ... config -q`,
   read logs and `state/status.json`.
3. **Only after an explicit "yes" from the person**, and after you said in one
   sentence what will happen: `docker compose ... up` (starts services, pulls
   images), writing or reloading the config of a reverse proxy, changing ports
   or the firewall, switching on `MUFFEL_WEBMENTIONS_SEND`, and anything that
   deletes data (`down --volumes`, removing folders).
4. **Ask, do not assume.** One question at a time, with the options named below.
   Do not invent addresses, tokens or mail settings. If the person does not know,
   say what they have to find out and where.
5. **Be honest.** Show the real output of a failed command. The steps inside the
   interfaces of Nextcloud, Memos and the mail provider are described from their
   documentation and were not checked against a live instance: say so.

## Pages to fetch

Base: `https://heiss.github.io/muffelblog/`. The raw Markdown of a page is easier
to read than the HTML:
`https://raw.githubusercontent.com/Heiss/muffelblog/main/apps/docs/src/content/docs/<path>.md`

| Page (`<path>`)           | Read it when                                                   |
| ------------------------- | -------------------------------------------------------------- |
| `start/quickstart`        | The person only wants to try the demo on their machine         |
| `tutorial/1-prepare`      | Real setup: Nextcloud folder, share, first memo                |
| `tutorial/2-publish`      | Real setup: `.env`, start, checks, troubleshooting             |
| `tutorial/3-comments`     | The person wants to try comments and moderation                |
| `tutorial/4-webmentions`  | The person wants to send webmentions                           |
| `production/overview`     | To choose between the setups                                   |
| `production/own-proxy`    | The person has their own reverse proxy (nginx, Caddy, Traefik) |
| `production/own-caddy`    | The person wants our Caddy with a domain                       |
| `reference/configuration` | For any variable you are unsure about                          |
| `production/operations`   | Status, backups, updates, monitoring                           |

## Steps

**0. Prerequisites.** `git`, `docker` and `docker compose` work on the machine
that will run the blog. Ask where that machine is (this one, or a server you can
reach with commands). Do not install software without asking.

**1. Ask which setup.** Offer exactly these:

- **A. Demo on this machine:** demo content, nothing public, no Nextcloud or
  Memos. Follow `start/quickstart`, then you are done.
- **B. Real blog behind the person's own reverse proxy:** `compose.yaml` +
  `compose.production.yaml`. Follow `tutorial/1-prepare`, `tutorial/2-publish`
  and `production/own-proxy`.
- **C. Real blog with our Caddy and a domain (HTTPS by itself):** `compose.yaml`
  - `compose.domain.yaml`. Follow `tutorial/1-prepare`, `tutorial/2-publish`
    and `production/own-caddy`.

**2. Sources (B and C).** The person prepares the Nextcloud folder, the public
share with a password and a public memo themselves: point them to
`tutorial/1-prepare` and wait. Ask them for `NEXTCLOUD_URL`,
`NEXTCLOUD_SHARE_TOKEN` (the part after `/s/`) and `MEMOS_URL`. No Memos token
exists or is needed.

**3. Ask for the values** (B and C), one at a time: the host names of the blog
and of the comments (`SITE_URL`, `COMMENTS_URL`; C also `SITE_ADDRESS`,
`COMMENTS_ADDRESS`), the mail settings (`MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USERNAME`), the address of the comment administrator
(`REMARK_ADMIN_EMAIL`), the language of the interface (`MUFFEL_LANG`: `en`, the
default, or `de`), and for B the folder that the proxy serves
(`MUFFEL_RELEASES_DIR`) and the kind of proxy. Mention, but do not push: sending
webmentions (`MUFFEL_WEBMENTIONS_SEND`) is **off** by default, and it stays off
unless the person asks for it. Also optional: an alert webhook
(`MUFFEL_ALERT_WEBHOOK`).

**4. Prepare.** Clone `https://github.com/Heiss/muffelblog.git`, run
`docker/init-env.sh` (it creates `.env` with its own random secrets and never
overwrites an existing file). Append the values with `printf 'NAME=%s\n' ...`,
only for names that are not in `.env` yet (`grep -q '^NAME=' .env`), plus
`MUFFEL_FIXTURES=` (empty, it switches the demo off) and the two empty password
lines. Tell the person to open `.env` and type the two passwords. Wait until
`grep -q '^NEXTCLOUD_SHARE_PASSWORD=.' .env` and the same for `SMTP_PASSWORD`
succeed. Then run `docker compose <files> config -q`; fix what it reports.

**5. Reverse proxy (B).** Fetch `production/own-proxy`, write the configuration
for the person's proxy from its example, show it, and ask before you apply or
reload it. The Content Security Policy in the example must stay exactly as it is.

**6. Start (after "yes").** `docker compose <files> up -d --build`. Watch
`docker compose logs builder`; the expected lines and the table of problems are
in `tutorial/2-publish`. Check `state/status.json` for `"state": "ok"`.

**7. Check with the person.** They open the blog and see the first post and memo
(`tutorial/2-publish`). Offer `tutorial/3-comments` and `tutorial/4-webmentions`
as the next steps, but do not start them unasked.

**8. Hand over.** Say what is running, where `.env` is, how to see the state
(`production/operations`), and what is left for the person: the legal pages of
the example folder contain **placeholders and are not legal advice**; they must
replace them before the blog is announced.
