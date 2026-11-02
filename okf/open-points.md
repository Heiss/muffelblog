---
type: Open Questions
title: Offene Punkte aus der kritischen Durchsicht
description: Priorisierte Liste der ungeklärten Entscheidungen, Widersprüche und ungeprüften Fakten.
tags: [offen, review, risiken]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

Die IDs (O1 bis O29) werden in den anderen Konzepten referenziert. Jeder Punkt
nennt, was der Spezifikation heute dazu eingetragen ist ("Eintrag") und was
dagegen spricht.

# A. Entscheidungen mit Auswirkung auf die Architektur

| ID | Thema | Eintrag / Problem | Auswirkung |
|---|---|---|---|
| O1 | Block-Quellen der Split-View | Drei Reihen technischer Blöcke (gemischt, Memos, Posts), Blockgröße 20. Der Nutzer hat nur die gemischten Blöcke bestätigt, die Split-View braucht aber pro Spalte eine eigene Liste. | [Feed](/frontend/feed.md) |
| O2 | Datumsformat und Zeitzone | Offen. Obsidian schreibt oft nur ein Datum ohne Uhrzeit. Memos haben eine Uhrzeit. Bei gleichem Tag ist die Reihenfolge unklar. Anzeige und Sortierung brauchen eine feste Zeitzone (Vorschlag: Europe/Berlin). | [Frontmatter](/content/frontmatter.md) |
| O3 | Zustand des Mention-Sync | Bei Verlust der Statusdatei würden alle Mentions doppelt gepostet. Vorschlag: Marker (Quell-URL) im Kommentartext, aus dem der Zustand aus Remark42 wiederhergestellt wird. | [Webmentions](/community/webmentions.md) |
| O5 | Fremdinhalte in Markdown | Remote-Bilder, iframes und Einbettungen in Artikeln: spiegeln, blockieren oder erlauben? Die Regel "nichts von anderen Diensten laden" und die CSP sprechen für spiegeln oder blockieren. | [Medien](/content/media.md) |
| O8 | Versionen: "immer neueste" gegen Pinning | Der Nutzer will für Memos und Nextcloud die neueste Version. Eine API-Änderung kann den Build brechen. Remark42, Caddy und Node sollten gepinnt sein. Widerspruch bleibt für Memos. | [Docker](/architecture/docker.md) |
| O9 | Reverse-Proxy, Domain, Remark42-Host | Läuft schon ein Proxy auf dem Server (Traefik, nginx)? Caddy ist nur ein Vorschlag. Remark42 braucht die öffentliche URL, vermutlich Subdomain. Betrieb unter Pfad ungeprüft. Domain steht aus. | [Docker](/architecture/docker.md) |
| O10 | Image-Build | Bauen auf dem Server (`compose build`) oder in CI mit Registry? Das Repo hat noch keinen Inhalt außer dieser Spezifikation, Struktur des Codes ist offen. | [Docker](/architecture/docker.md) |
| O28 | Basis-Branch und Branch-Konvention | Das Repo hat nur den Branch dieser Sitzung. Für Feature-Branches und Pull Requests braucht es einen Basis-Branch. Eintrag in der [Roadmap](/roadmap.md): `feature/wNN-<kurzname>`. | [Roadmap](/roadmap.md) |
| O29 | Teststrategie für externe Dienste | Echte Testinstanzen (Nextcloud, Memos, Remark42, Mail-Sink) oder Mocks? Beides mischen? Betrifft W02, W04, W13, W14. | [Roadmap](/roadmap.md) |
| O27 | Auslegung von "standalone" | Der Nutzer schrieb "Der Dienst sollte standalone funktionieren, wenn etwas ausgeliefert wird". Eintrag: ausgelieferte Seite läuft ohne Nextcloud, Memos und Fremddienste. Das wurde nicht ausdrücklich bestätigt. | [System](/architecture/system.md) |

# B. Inhalt und Verhalten

| ID | Thema | Eintrag / Problem |
|---|---|---|
| O4 | Remark42-Darstellung | Standardsortierung im Widget und Darstellung des Autors `admin` sind ungeprüft. Die Zeitleiste mit Mentions funktioniert nur bei Sortierung nach Zeit. |
| O6 | Anhänge, die keine Bilder sind | Audio, Video, PDF in Memos: spiegeln, verlinken auf die Memos-Instanz (widerspricht der Regel) oder weglassen? |
| O7 | Bildgrößen und Formate | Responsive Größen und WebP/AVIF per Astro-Bildverarbeitung? Eintrag nur: EXIF entfernen, SVG ablehnen. |
| O11 | Webmentions: Sender und Microformats | Implementierung des Senders offen. `h-entry`/`h-card`, `rel=me`, IndieAuth wurden nicht besprochen, sind für sinnvolle Anzeige aber nötig. |
| O12 | Senden aus Memos | Der Nutzer sagte "ja auf jeden Fall" für Senden und "auch für Memo-Seiten" für Mentions. Senden aus Memos ist eine Annahme. |
| O13 | Tag-Regeln | Groß-/Kleinschreibung, Umlaute, verschachtelte Memos-Tags (`#a/b`), zählen Inline-`#tags` in Artikeln? Gemeinsamer Namensraum für Posts und Memos ist ein Vorschlag. |
| O14 | Memo-Datum | `createTime` oder `displayTime`? Titel-Ableitung bei Memos, die nur ein Bild enthalten. |
| O20 | Feed-Darstellung von Posts, RSS-Umfang | Länge des Auszugs, Anzahl RSS-Einträge, Volltext oder Auszug. |
| O21 | Zurückgezogene Artikel | `publish` entfernt: Seite 404 oder 410, Löschbenachrichtigung per Webmention? |
| O26 | Doppelte Slugs | Beide ablehnen (Build-Fehler für diese Dateien) oder die ältere behalten? |

# C. Betrieb, Recht, Gestaltung

| ID | Thema | Eintrag / Problem |
|---|---|---|
| O15 | Impressum, Datenschutz | Ein Blog mit Kommentaren, E-Mail-Login und Server-Logs braucht voraussichtlich Impressum und Datenschutzerklärung. Rechtlich zu klären. Statische Seiten wie "Über" und "Impressum" sind im Konzept nicht vorgesehen (aus Markdown in Nextcloud?). |
| O16 | Gestaltung | Name der Seite, Farben, Typografie, Dark Mode, Favicon, Barrierefreiheit wurden nicht besprochen. |
| O17 | Open Graph, Social Cards | Vorschaubilder und Meta-Tags wurden nicht besprochen. |
| O18 | Backup, Alerting | Remark42-Daten und `state` sichern. Kanal für Build-Fehler (E-Mail, Push, Matrix?). Remark42 sichert täglich nach `BACKUP_PATH`, ersetzt aber kein externes Backup. |
| O19 | Statistik | Eintrag: keine. Falls doch, ohne Fremddienste. |
| O22 | Moderation | Benachrichtigung bei neuen Kommentaren, Spam-Maßnahmen jenseits der E-Mail-Pflicht. |
| O23 | Entwicklungsablauf | Lokales Arbeiten (`astro dev` mit Beispieldaten), Tests, Linting des Frontmatter-Schemas. |
| O24 | 404-Seite, `robots.txt` | Nicht besprochen. |
| O25 | Ungeprüfte Fakten | siehe Abschnitt D. |

# D. Ungeprüfte Fakten (müssen vor der Umsetzung belegt werden)

* Memos: öffentliche Liste und Anhänge ohne Token abrufbar, API-Form der
  verwendeten Version.
* Nextcloud: Public-Share-WebDAV mit Token und Passwort, Verhalten von
  `getlastmodified`, Konfliktdatei-Muster.
* webmention.io: öffentliche API ohne Token, Parameter `since`, Verhalten bei
  Löschung.
* Remark42: Admin-Basic-Auth auf `POST /api/v1/comment` (laut Quellcode
  möglich, kein eigener `BasicAuthChecker` geprüft), Darstellung von Links im
  Kommentartext, Widget-Sortierung, iframe oder nicht, Betrieb unter Pfad,
  Länge-Limit für Kommentare.
* Migadu: Host, Ports, Absender-Regeln.
* Pagefind: deutsche Oberfläche.
* Astro: Verhalten des Standard-Slugger bei Umlauten.

# Korrekturen gegenüber früheren Aussagen

* Memos live per `fetch`: verworfen, Memos kommen zur Build-Zeit.
* Kommentare "nur auf Posts": geändert auf Posts und Memos.
* Mentions per Import in Remark42: verworfen (`DeleteAll`), stattdessen Posten
  über die API.
* Das Remark42-Widget war als iframe beschrieben: unbestätigt.
