---
title: Proxy serves the files
description: Advanced - your nginx or Caddy serves the files of the blog from a host folder instead of forwarding to our web server.
---

:::note[Advanced]
The normal setup is simpler: your proxy only forwards to our web server, see
[Getting started](/muffelblog/start/getting-started/). Use this page only if
your proxy must serve the files itself. Then it also has to send the security
headers, set the cache rules and protect the comments administrator, as below.
:::

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
sudo chown 1000:1000 /srv/muffelblog/releases   # the builder runs as uid 1000, not root
```

The builder does not run as root, it runs as the user `node` (uid 1000), so the
folder must belong to uid 1000. Your proxy only **reads** it (the files are
readable for everybody), so it can run as any user.

Fill in `.env` as in [Getting started](/muffelblog/start/getting-started/),
and add:

```sh
COMPOSE_FILE=compose.yaml:compose.host-folder.yaml
MUFFEL_RELEASES_DIR=/srv/muffelblog/releases
```

## 2. Start

```sh
docker compose up -d
```

What this changes: our `web` is not started, the releases go to
`MUFFEL_RELEASES_DIR`, and Remark42 listens on `127.0.0.1:8082` (set
`REMARK_PORT` to change it).

The folder holds one directory per release and a relative link `current`.
Because the link is relative, it works wherever your proxy sees the folder (for
example mounted into a container at another path). The builder keeps the newest 3
releases (`MUFFEL_RELEASES_KEPT`), so a browser tab that is still open can finish
loading its files.

:::note
Files are written by uid 1000 with normal permissions (readable by everyone).
Your proxy only needs read access.
:::

## 3. Configure the proxy

The Content Security Policy below must be sent for the blog host. It allows
scripts and frames only from the blog itself, from your comments host, and from
`youtube-nocookie.com` (frames only); images only from the blog and the three
image hosts allowed in posts. Replace `comments.example.org` with your host. With
[Matomo](/muffelblog/guides/statistics/) add its address to `script-src`,
`connect-src` and `img-src`.

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
	@buildjson path /build.json /health.json /entries.json
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
		header_up X-Real-IP {client_ip}
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
    location ~ ^/(build|health|entries)\.json$ {
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
        proxy_set_header X-Real-IP $remote_addr;
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

Traefik does not serve static files. Use the normal setup of
[Getting started](/muffelblog/start/getting-started/) instead.

## Client addresses and the rate limit

Remark42 limits how fast one visitor may read and write. It finds the visitor's
address in the header `X-Real-IP`. Two things must be true, or anybody can pick
any address and get around the limit (Remark42 warns about this in its log):

1. **Your proxy sets `X-Real-IP` itself** and never passes on the visitor's value.
   The Caddy and nginx examples above do exactly that. A proxy that only appends
   to `X-Forwarded-For` (Traefik, most cloud load balancers) does not do it; use
   the normal setup with such a proxy.
2. **`TRUSTED_PROXY` names the network your proxy connects from**, and nothing
   wider. The default `172.16.0.0/12` covers the Docker networks, which is right
   when the proxy is on this host: a proxy on the host reaches the published
   port `127.0.0.1:8082` through the Docker gateway, an address in that range.
   For a proxy on **another machine** set `TRUSTED_PROXY` to its address.
   Remark42's own port must never be reachable from outside (this setup binds it
   to `127.0.0.1`). If your Docker uses address pools outside `172.16.0.0/12`
   or IPv6, add them.

## 4. Check

- `https://blog.example.org/build.json` returns the build id and time.
- `https://blog.example.org/` has the header `Content-Security-Policy` (browser
  developer tools, network tab) and the console shows no policy violations.
- `curl -s -o /dev/null -w '%{http_code}\n' -H 'Authorization: Basic YTpi' https://comments.example.org/ping` prints **403**.
- A request without that header to `https://comments.example.org/ping` prints `pong`.

The nginx example is written from the documentation of nginx and has **not**
been run against a real installation; the Caddy configuration is the one our own
web server uses (`docker/Caddyfile`), without the client address handling for a
proxy in front.
