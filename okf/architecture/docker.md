---
type: Deployment
title: Docker-Betrieb
description: Dienste, Netze, Volumes, Secrets und Release-Austausch der Docker-Auslieferung.
tags: [docker, betrieb, caddy, remark42]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Entscheidung

**[E]** Alles wird über Docker verteilt, auf einem Server.

# Dienste (Vorschlag)

**[V]** Drei Container in einer Compose-Datei:

| Dienst | Inhalt | Netz |
|---|---|---|
| `web` | Caddy: TLS, statische Auslieferung, Reverse-Proxy zu Remark42 | intern + öffentlich |
| `builder` | Node/Astro, Pagefind, rclone, Scheduler, Mention-Sync, Mention-Versand | intern |
| `remark42` | Kommentare, E-Mail-Login | intern |

Memos und Nextcloud laufen extern bzw. bereits vorhanden und sind nicht Teil
der Compose-Datei.

# Volumes (Vorschlag)

* `releases`: Build-Ausgaben `releases/<build-id>/` plus Symlink `current`,
  von `web` gelesen, vom `builder` geschrieben.
* `state`: Zustand des Builders (zuletzt gesehene Stände, gesendete
  Webmentions, Zuordnung Mention zu Kommentar).
* `remark42-var`: Datenbank und Backups von Remark42 (persistent, gesichert).
* `cache`: Zwischenspeicher für gespiegelte Bilder und Sync-Stand.

# Release-Austausch (Vorschlag)

* Build in ein neues Verzeichnis `releases/<id>/`.
* `build.json` wird als letzte Datei geschrieben.
* Danach Symlink `current` atomar umhängen (neuer Symlink, dann `rename`).
* Die letzten N Releases bleiben erhalten (Vorschlag: 3), damit offene Tabs
  ihre gehashten Assets noch laden können.

# Reverse-Proxy-Regeln (Vorschlag)

* `Authorization: Basic ...` wird auf allen öffentlichen Routen von Remark42
  abgewiesen. Der Builder spricht Remark42 direkt im internen Netz an.
* Caddy setzt eine strikte Content-Security-Policy: `script-src 'self'`.
  `img-src` enthält `'self'` und die Bild-Hosts aus `policy.ts`, `frame-src`
  die Hosts der Einbettungs-Regeln. Das Widget kommt vom eigenen Host. Die
  Hosts werden aus derselben Liste erzeugt wie die Prüfung im Build.
* `build.json` wird mit `Cache-Control: no-cache` und ETag ausgeliefert, damit
  bedingte Abfragen mit 304 antworten. Alle anderen Assets sind gehasht und
  langfristig cachebar.

# Secrets und Umgebungsvariablen

**[E]** Die Absenderadresse für Login-Mails kommt per Umgebungsvariable.

**[V]** Secrets nicht ins Repo, sondern als Docker-Secrets oder `.env` auf dem
Server:

* Nextcloud: Share-Token und Share-Passwort
* Memos: URL (und ein Token, falls Anhänge es verlangen)
* Remark42: `SECRET`, `ADMIN_PASSWD`, `AUTH_EMAIL_FROM`, `SMTP_*`
* webmention.io: Zugangsdaten, falls für die API nötig

`ADMIN_PASSWD` ist ein Master-Schlüssel (siehe
[Kommentare](/community/comments.md)) und liegt nur im `builder` und in
`remark42`.

# Image-Versionen

**[E]** Der Nutzer will für Memos und Nextcloud "immer das neueste".
**[V]** Für die eigenen Container (Remark42, Caddy, Node-Basis) werden Tags
oder Digests gepinnt, weil ein unbemerktes Update den Build oder die API
brechen kann. Der Widerspruch zu "immer neueste" ist in
[Offene Punkte](/open-points.md) als O8 erfasst.

# Offen

O9 (Reverse-Proxy, Domain, Hostname von Remark42), O10 (Image-Build auf dem
Server oder über eine Registry), O18 (Backup, Monitoring).
