---
title: Reverse proxy examples
description: Forward the blog and the comments host from Caddy, nginx or Traefik to the two local ports.
---

Your proxy only forwards: the blog host to `127.0.0.1:8080`, the comments host
to `127.0.0.1:8081`, both plain HTTP, with HTTPS on the outside. The blog sets
its own security headers. Replace `blog.example.org` and `comments.example.org`
with your host names (the same as in `SITE_URL` and `COMMENTS_URL`).

## Caddy

```caddyfile
blog.example.org {
	reverse_proxy 127.0.0.1:8080
}

comments.example.org {
	reverse_proxy 127.0.0.1:8081
}
```

Caddy fetches the certificates itself and sends `X-Forwarded-For`.

## nginx

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name blog.example.org;
    # ssl_certificate ... (your certificates)

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl;
    http2 on;
    server_name comments.example.org;
    # ssl_certificate ...

    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Traefik

File provider; Traefik sends `X-Forwarded-For` by itself.

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

## Proxy in a container or on another machine

The two ports listen on `127.0.0.1` only, so only a proxy on the same host
reaches them. Otherwise:

| Variable                              | Set it to                                                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MUFFEL_BIND`                         | An address of this host that the proxy reaches (for example the Docker bridge `172.17.0.1` or a private network address). Never `0.0.0.0` without a firewall. |
| `MUFFEL_PORT`, `MUFFEL_COMMENTS_PORT` | Other ports, if 8080 or 8081 are taken.                                                                                                                       |
| `MUFFEL_TRUSTED_PROXIES`              | The address of your proxy, see below.                                                                                                                         |

## Visitor addresses

The comments server limits how fast one visitor may read and write, so it needs
the real address of the visitor. Our web server takes it from the
`X-Forwarded-For` header, but only from senders in `MUFFEL_TRUSTED_PROXIES`
(default `private_ranges`: the private and local networks, which covers a proxy
on the same host). It reads the header from the right, so a visitor cannot put a
false address in front.

If other machines of a private network can reach the ports (`MUFFEL_BIND` not
`127.0.0.1`), set `MUFFEL_TRUSTED_PROXIES` to the address of your proxy only,
for example `10.0.0.5/32`; several are separated by spaces.

## Check

- `https://blog.example.org/build.json` answers with the build id and time.
- `https://comments.example.org/ping` answers `pong`.
- With `-H 'Authorization: Basic YTpi'` the same address answers **403**: the
  administrator login of the comments server is refused from outside.

The CI of the project tests our web server on the two ports, but not with a
proxy in front. The three snippets are written from the documentation of the
programs and have **not** been run against real installations.
