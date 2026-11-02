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

**[V]** Das Rendering des Markdown läuft über eine feste Pipeline mit
Allowlist für HTML (zum Beispiel `rehype-sanitize`). Rohes HTML im Markdown
ist standardmäßig aus.

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

**[V]** `script-src 'self'`, `img-src 'self'`, keine Fremdquellen. Das passt
zur Regel, dass der Browser nichts von Drittdiensten lädt.
