---
title: Your own reverse proxy
description: Run the builder and Remark42 in Docker and serve the blog from your existing nginx, Caddy or Traefik through a shared folder.
---

Here the builder writes the finished site into a **folder on the host**. Your
proxy serves that folder directly; only Remark42 is reached over the network.

```text
builder ──writes──► /srv/muffelblog/releases/<id>/ ◄──symlink── current
                                     ▲
                      your proxy serves /srv/muffelblog/releases/current
Remark42 ◄── 127.0.0.1:8082 ◄── your proxy (comments host)
```

## 1. Prepare

```sh
sudo mkdir -p /srv/muffelblog/releases
```

In `.env`:

```sh
MUFFEL_RELEASES_DIR=/srv/muffelblog/releases
SITE_URL=https://blog.example.org
COMMENTS_URL=https://comments.example.org
MAIL_FROM=blog@example.org
SMTP_HOST=smtp.example.org
SMTP_PORT=465
SMTP_USERNAME=blog@example.org
SMTP_PASSWORD=...
```

## 2. Start

```sh
docker compose -f compose.yaml -f compose.production.yaml up -d
```

What this changes: our `web` and `mailpit` are not started, the releases go to
`MUFFEL_RELEASES_DIR`, Remark42 listens on `127.0.0.1:8082` (set `REMARK_PORT` to
change it) and the mail variables are **required**.

The folder holds one directory per release and a relative link `current`.
Because the link is relative, it works wherever your proxy sees the folder (for
example mounted into a container at another path). The builder keeps the newest 3
releases (`MUFFEL_RELEASES_KEPT`), so a browser tab that is still open can finish
loading its files.

:::note
Files are written as root inside the container with normal permissions
(readable by everyone). Your proxy only needs read access.
:::

## 3. Configure the proxy

The Content Security Policy below must be sent for the blog host. It allows
scripts and frames only from the blog itself, from your comments host, and from
`youtube-nocookie.com` (frames only); images only from the blog and the three
image hosts allowed in posts. Replace `comments.example.org` with your host.

```text
default-src 'none'; script-src 'self' 'wasm-unsafe-eval' https://comments.example.org; style-src 'self'; font-src 'self'; img-src 'self' https://upload.wikimedia.org https://raw.githubusercontent.com https://user-images.githubusercontent.com; frame-src https://www.youtube-nocookie.com https://comments.example.org; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'
```

### Caddy

```caddyfile
blog.example.org {
	root * /srv/muffelblog/releases/current
	encode zstd gzip

	header {
		Content-Security-Policy "default-src 'none'; script-src 'self' 'wasm-unsafe-eval' https://comments.example.org; style-src 'self'; font-src 'self'; img-src 'self' https://upload.wikimedia.org https://raw.githubusercontent.com https://user-images.githubusercontent.com; frame-src https://www.youtube-nocookie.com https://comments.example.org; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
		X-Content-Type-Options nosniff
		Referrer-Policy strict-origin-when-cross-origin
		-Server
	}
	@buildjson path /build.json
	header @buildjson Cache-Control "no-cache"
	@hashed path /_astro/*
	header @hashed Cache-Control "public, max-age=31536000, immutable"

	file_server
	handle_errors {
		rewrite * /404.html
		file_server
	}
}

comments.example.org {
	@basic header Authorization Basic*
	respond @basic "Forbidden" 403
	reverse_proxy 127.0.0.1:8082 {
		header_up -Authorization
	}
}
```

This is the same configuration our own Caddy uses (`docker/Caddyfile`).

### nginx

```nginx
server {
    listen 443 ssl http2;
    server_name blog.example.org;
    # ssl_certificate ... (your certificates)

    root /srv/muffelblog/releases/current;
    index index.html;
    error_page 404 /404.html;

    add_header Content-Security-Policy "default-src 'none'; script-src 'self' 'wasm-unsafe-eval' https://comments.example.org; style-src 'self'; font-src 'self'; img-src 'self' https://upload.wikimedia.org https://raw.githubusercontent.com https://user-images.githubusercontent.com; frame-src https://www.youtube-nocookie.com https://comments.example.org; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'" always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    location / {
        try_files $uri $uri/index.html =404;
    }
    location = /build.json {
        add_header Cache-Control "no-cache" always;
        # add_header in a location replaces the ones above: repeat them here
        add_header Content-Security-Policy "default-src 'none'" always;
        add_header X-Content-Type-Options nosniff always;
    }
    location /_astro/ {
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        add_header X-Content-Type-Options nosniff always;
    }
}

server {
    listen 443 ssl http2;
    server_name comments.example.org;
    # ssl_certificate ...

    # The administrator login must never come in from outside.
    if ($http_authorization ~* "^Basic") { return 403; }

    location / {
        proxy_set_header Authorization "";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass http://127.0.0.1:8082;
    }
}
```

:::caution
In nginx, `add_header` inside a `location` replaces all `add_header` lines of
the outer level. The example repeats the important ones; keep that in mind when
you add locations.
:::

### Traefik

Traefik routes requests, it **does not serve static files** and has no rule to
refuse a request header. So let our Caddy do those two jobs behind Traefik: start
it with the profile `own-caddy`. It then serves the same host folder, sets the
Content Security Policy and refuses `Authorization: Basic` on the comments host.

```sh
docker compose -f compose.yaml -f compose.production.yaml --profile own-caddy up -d
```

Our Caddy listens on the published ports `MUFFEL_PORT` (default 8080, the blog)
and `MUFFEL_COMMENTS_PORT` (default 8081, the comments). Traefik only needs to
forward the two host names to them:

```yaml
http:
  routers:
    blog:
      rule: Host(`blog.example.org`)
      entryPoints: [websecure]
      tls: { certResolver: letsencrypt }
      service: blog
    comments:
      rule: Host(`comments.example.org`)
      entryPoints: [websecure]
      tls: { certResolver: letsencrypt }
      service: comments
  services:
    blog:
      loadBalancer:
        servers: [{ url: 'http://127.0.0.1:8080' }]
    comments:
      loadBalancer:
        servers: [{ url: 'http://127.0.0.1:8081' }]
```

Set `COMMENTS_URL=https://comments.example.org` in `.env` so the policy names the
right origin. The two ports are published on all interfaces by `compose.yaml`;
block them from outside in your firewall.

## 4. Check

- `https://blog.example.org/build.json` returns the build id and time.
- `https://blog.example.org/` has the header `Content-Security-Policy` (browser
  developer tools, network tab) and the console shows no policy violations.
- `curl -s -o /dev/null -w '%{http_code}\n' -H 'Authorization: Basic YTpi' https://comments.example.org/ping` prints **403**.
- A request without that header to `https://comments.example.org/ping` prints `pong`.

The nginx and Traefik examples are written from the documentation of the two
programs and have **not** been run against real installations; the Caddy
configuration is the one the project tests in CI.
