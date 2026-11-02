---
type: Feature
title: Kommentare mit Remark42
description: Selbst gehostete Kommentare mit E-Mail-Login, Widget und statischer Kopie.
tags: [kommentare, remark42, smtp, migadu]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
sources:
  - id: remark42-docs
    resource: https://github.com/umputun/remark42/tree/master/site/content/docs
    title: Remark42 Dokumentation im Repository
  - id: remark42-api
    resource: https://raw.githubusercontent.com/umputun/remark42/master/site/content/docs/contributing/api/index.md
    title: Remark42 REST-API
  - id: remark42-create
    resource: https://raw.githubusercontent.com/umputun/remark42/master/backend/app/rest/api/rest_private.go
    title: Remark42 createCommentCtrl
  - id: pkgz-auth
    resource: https://raw.githubusercontent.com/go-pkgz/auth/master/middleware/auth.go
    title: go-pkgz/auth Middleware mit Admin-Basic-Auth
---

# Entscheidungen

* **[E]** Remark42 als selbst gehostete Lösung, keine GitHub-Abhängigkeit.
* **[E]** Kommentare auf Posts und Memos. Keine Kommentare auf der Memos-
  Instanz selbst.
* **[E]** Login nur per E-Mail, kein anonymes Kommentieren, keine Social-Logins.
* **[E]** Das Widget ist aktiv und lädt vom eigenen Server. Zusätzlich liegt eine
  statische Kopie der Kommentare im HTML für SEO und für Besucher ohne
  JavaScript.
* **[E]** SMTP über Migadu. Die Absenderadresse kommt per Umgebungsvariable.
* **[E]** Webmentions erscheinen als Einträge in derselben Zeitleiste (siehe
  [Webmentions](/community/webmentions.md)).

# Konfiguration

* `AUTH_EMAIL_ENABLE=true`, `AUTH_EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`,
  `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_TLS` oder `SMTP_STARTTLS`.[^remark42-docs]
* `AUTH_ANON` ist standardmäßig aus. OAuth-Anbieter sind nur aktiv, wenn ihre
  Client-ID gesetzt ist. Keine IDs setzen.[^remark42-docs]
* `ADMIN_PASSWD` aktiviert Basic-Auth für den Nutzer `admin`. Standardmäßig ist
  das aus.[^remark42-docs]
* **[U]** Für Migadu sind `smtp.migadu.com` mit Port 465 (TLS) oder 587
  (STARTTLS) üblich. Absender muss ein Postfach oder Alias der Domain sein, SPF,
  DKIM und DMARC müssen gesetzt sein. Nicht geprüft.
* **[V]** Das Widget bekommt `host`, `site_id` und `url` (kanonische URL der
  Seite). Der Pfad der Seite ist der Schlüssel der Kommentare.

# Lesen für den Build

`GET /api/v1/find?site=...&url=...` ist öffentlich und braucht keine
Authentifizierung.[^remark42-api] Die statische Kopie wird daraus erzeugt und
nach [Bereinigung](/security/sanitization.md) gerendert.

# Moderation und Spam

* **[V]** Moderation über die Remark42-Oberfläche als Admin.
* Ein freigegebener oder neuer Kommentar erscheint in der statischen Kopie
  erst nach dem nächsten Scheduler-Lauf. Im Widget sofort.
* Die E-Mail-Adressen der Kommentierenden liegen beim Betreiber
  (Datenschutz, siehe O15).

# Admin-Zugriff für Skripte

Skripte authentifizieren sich per HTTP Basic Auth mit Benutzer `admin` und
`ADMIN_PASSWD`.[^pkgz-auth] Die Auth-Middleware setzt die feste Identität
`admin`, auch für `POST /api/v1/comment`.[^remark42-create]

* `ADMIN_PASSWD` ist ein Master-Schlüssel. Er erlaubt auch Export und Import
  unter `/api/v1/admin/...`. Ein Import ersetzt alle Kommentare der Site
  (siehe [Webmentions](/community/webmentions.md)).
* **[V]** Der Reverse-Proxy lehnt Anfragen mit `Authorization: Basic` von außen
  ab (siehe [Docker](/architecture/docker.md)).
* **[U]** Ob Remark42 einen eigenen `BasicAuthChecker` setzt, der diesen Weg
  abschaltet, ist nicht geprüft.

# Unbestätigt

* **[U]** Das Widget wird per Script in ein `<div>` eingehängt. Ob es dabei einen
  iframe nutzt, steht in den gelesenen Seiten nicht.
* **[U]** Standardsortierung im Widget (nach Zeit oder Bewertung) und ob der
  Betreiber sie festlegen kann: nicht geprüft (O4).
* **[U]** Betrieb unter einem Pfad statt einer Subdomain: nicht geprüft (O9).

[^remark42-docs]: Remark42 Dokumentation im Repository
[^remark42-api]: Remark42 REST-API
[^remark42-create]: Remark42 createCommentCtrl
[^pkgz-auth]: go-pkgz/auth Middleware mit Admin-Basic-Auth
