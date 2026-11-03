---
type: Policy
title: Bereinigung fremder Inhalte
description: Sanitizing, SSRF-Schutz und Umgang mit Secrets für alle fremden oder halb vertrauenswürdigen Eingaben.
tags: [sicherheit, sanitizing, ssrf, secrets]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Entscheidung

**[E]** Alle Fremdinhalte werden bereinigt.

# Eingaben und Regeln

| Eingabe | Vertrauen | Regel |
|---|---|---|
| Artikel-Markdown (Nextcloud) | eigen, aber ein Share-Link-Leak ist möglich | durch dieselbe Bereinigung wie alles andere |
| Memos-Markdown | eigen | wie Artikel |
| Webmentions | fremd | nur Text, kein HTML |
| Kommentare (Remark42) | fremd | HTML nur über Allowlist, auch wenn Remark42 selbst bereinigt |
| Avatare und Memo-Bilder | fremd bzw. eigen | Typ- und Größenprüfung, EXIF entfernen, SVG ablehnen |

**[E]** Das Rendering des Markdown läuft über eine feste Pipeline
(`packages/core/src/render.ts`): Markdown (mit GFM), rohes HTML geparst, dann
eine Allowlist (`rehype-sanitize`), danach die Prüfung von Bildern, Links und
Einbettungen. Rohes HTML bleibt nur im Rahmen der Allowlist erhalten: Skripte,
Ereignis-Attribute, `javascript:`- und `data:`-Verweise, Formulare, Stile, SVG,
Objekte und Kommentare entfallen samt Inhalt. Danach färbt `lowlight` Code-Blöcke mit bekannter Sprache über Klassen
(`hljs-*`), nicht über Stile; die Klassen stammen nur aus dem Färben. Externe
Links bekommen `rel="noopener noreferrer"`, Überschriften rücken eine Ebene nach unten.

# SSRF-Schutz

* **[V]** Beim Abruf von Fremd-URLs (Avatare, Mention-Quellen, Ziele beim
  Senden) werden private und interne IP-Bereiche, Loopback und Link-Local
  abgelehnt, auch nach Auflösen von Weiterleitungen.
* **[V]** Zeit-, Größen- und Weiterleitungslimits für jeden Abruf.

# Secrets

* **[V]** Secrets liegen nicht im Repo (siehe [Docker](/architecture/docker.md)).
* **[V]** `ADMIN_PASSWD` nur im `builder` und in `remark42`.
* **[V]** Der Share-Link von Nextcloud ohne Passwort ist verboten, weil er den
  ganzen Ordner einschließlich Entwürfen öffentlich macht.

# Content-Security-Policy

**[V]** `script-src 'self'`. `img-src` mit `'self'` und den freigegebenen
Bild-Hosts, `frame-src` mit den freigegebenen Einbettungs-Hosts (siehe
[Medien](/content/media.md)). Es gibt keine weiteren Fremdquellen.
