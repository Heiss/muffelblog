---
type: Review
title: Security review for the first release
description: What was checked (secrets, SSRF, sanitizing, headers, exposure, containers, dependencies), what was found and what is open.
tags: [security, review, ssrf, headers, secrets]
status: draft
generated: { by: claude-code/web, at: 2026-11-05T00:30:00Z }
---

# Scope and method

Done on 2026-11-05 for W16 by reading the code and the configuration, and by
running tests and `pnpm audit`. It is **not** an independent audit and no
penetration test: nothing was attacked from outside, and a Caddy with a real
domain was never run (see [Docker](/architecture/docker.md)).

# Results

| Area | Checked | Result |
|---|---|---|
| Secrets in the repo | Search for keys, tokens and passwords in all tracked files | No findings. Only throw-away values of the CI test services (`ci.yml`) and placeholders in the docs. `.env` is ignored by git; `docker/init-env.sh` creates it with mode `600`. |
| Secrets in the build | Environment of the build | The Nextcloud share password, its file variant and the token are removed from the environment of the site build. rclone gets the password obscured through stdin. `REMARK_ADMIN_PASSWD` is not in the environment of the builder; `docker/moderate.sh` passes it to one command only. |
| SSRF: webmention sender | `safeFetch` | Only http(s), no credentials in the address, every resolved address must be public (IPv4 and IPv6 including mapped, NAT64 and 6to4 forms), the connection uses the checked address, every redirect is checked again, limits for time and size. Tested with real local servers. `MUFFEL_WEBMENTIONS_ALLOW_PRIVATE` lifts it and is documented as tests and tutorial only. |
| SSRF: Memos, Nextcloud, Remark42, alert webhook | Addresses come from the operator (`.env`), not from content | **Accepted knowingly.** They are often on a private network (Docker, LAN), so a public-address rule would break them. Redirects of the Memos requests are not followed. Attachments are fetched only through the file route of the configured instance. |
| Sanitizing | Markdown, memos, comments | One sanitizer (`rehype-sanitize` allowlist) for posts, memos and comments. Foreign images and embeds only from allowlists, embeds load after a click, memos and comments are strict. Comments are inserted into the page only after sanitizing. |
| Headers | `docker/Caddyfile` | Content Security Policy without `unsafe-inline`, `nosniff`, `Referrer-Policy`, no `Server` header. Basic auth is refused on the comments host, `X-Real-IP` is set by the proxy. **No HSTS**: see findings. |
| Exposure of ports | `compose.yaml` | **Finding, fixed:** the site and comments ports were published on all interfaces. They now listen on `127.0.0.1` (`MUFFEL_BIND`). Mailpit and Remark42 (production) were already on `127.0.0.1`. |
| Comments administrator | `compose.yaml` | `REMARK_ADMIN_EMAIL` is required for notifications; UI privileges use the explicitly configured authenticated `REMARK_ADMIN_ID` (`ADMIN_SHARED_ID`). |
| Webmention state | change of the domain | **Finding, fixed:** after a change of `SITE_URL` every entry would have looked new and all links would have been reported again. The sender now stores the entries without sending (like the first start). |
| Dependencies | `pnpm audit` | Production dependencies: no known vulnerabilities. Development: one moderate advisory in `eslint > minimatch` (GHSA-g3hv-75wg-m249), not shipped, left to Renovate. |
| Containers | Dockerfile | **Finding, fixed:** the builder ran as `root`. It now runs as the user `node` (uid 1000); the data folders and the places where the build writes belong to that user, the rest of the repository stays root-owned. A start check names a folder that is not writable (volumes of older versions) and says how to repair it. CI checks the user and the write access. |

# Open findings

* **HSTS.** `Strict-Transport-Security` is not set by our Caddy (the same file
  serves plain HTTP in the demo, where it would be wrong) and is not in the
  proxy examples. Set it at your proxy once HTTPS works; start with a short
  `max-age`, because browsers remember it. Mentioned in the production overview. **Decided by the owner: HSTS is the job of the reverse proxy, our setup does not provide it.**
* **HEIC converter.** `heif-convert` (libheif) parses untrusted photos from Nextcloud and Memos, a typical source of memory errors. Mitigations: no shell, size and time limit, content check before the call, unprivileged user `node`, temporary folder removed. Keep the image updated (Renovate does not cover the apt packages: rebuild the image for Debian security updates).
* **Not tested:** a real domain with certificates, a real mail provider, the
  Remark42 widget in a browser, other proxies than the examples.
