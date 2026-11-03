---
type: Open Questions
title: Offene Punkte aus der kritischen Durchsicht
description: Priorisierte Liste der ungeklärten Entscheidungen, Widersprüche und ungeprüften Fakten.
tags: [offen, review, risiken]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

Die IDs (O1 bis O39) werden in den anderen Konzepten referenziert. Jeder Punkt
nennt, was der Spezifikation heute dazu eingetragen ist ("Eintrag") und was
dagegen spricht.

# A. Entscheidungen mit Auswirkung auf die Architektur

| ID | Thema | Eintrag / Problem | Auswirkung |
|---|---|---|---|
| O1 | Block-Reihen für den Filter | **[E]** Drei Reihen technischer Blöcke (gemischt, Memos, Posts), Blockgröße 20, umgesetzt in W05. Die Split-View entfällt. | [Feed](/frontend/feed.md) |
| O2 | Datumsformat und Zeitzone | **[E] entschieden:** reines Datum = 12:00 Uhr Berlin, Uhrzeit ohne Zone = Berliner Ortszeit, mit Zone gilt der Zeitpunkt. | [Frontmatter](/content/frontmatter.md) |
| O3 | Zustand des Mention-Sync | Bei Verlust der Statusdatei würden alle Mentions doppelt gepostet. Vorschlag: Marker (Quell-URL) im Kommentartext, aus dem der Zustand aus Remark42 wiederhergestellt wird. | [Webmentions](/community/webmentions.md) |
| O5 | Fremdinhalte in Markdown | **[E] entschieden:** In Artikeln erlaubt, aber nur aus Freigabelisten. Bilder: `upload.wikimedia.org`, `raw.githubusercontent.com`, `user-images.githubusercontent.com`. Einbettungen: `www.youtube-nocookie.com`, erst nach Klick. Memos bleiben strikt (Bilder gespiegelt). Das weicht von der früheren Regel "nichts von anderen Diensten laden" ab. Risiko: IP-Adressen der Besucher gehen an die Bild-Hosts (O15). | [Medien](/content/media.md) |
| O8 | Versionen: "immer neueste" gegen Pinning | Der Nutzer will für Memos und Nextcloud die neueste Version. Eine API-Änderung kann den Build brechen. Remark42, Caddy und Node sollten gepinnt sein. Widerspruch bleibt für Memos. | [Docker](/architecture/docker.md) |
| O9 | Reverse-Proxy, Domain, Remark42-Host | Läuft schon ein Proxy auf dem Server (Traefik, nginx)? Caddy ist nur ein Vorschlag. Remark42 braucht die öffentliche URL, vermutlich Subdomain. Betrieb unter Pfad ungeprüft. Domain steht aus. | [Docker](/architecture/docker.md) |
| O10 | Image-Build | Teilentscheidung **[E]**: CI läuft mit GitHub Actions. Das Dockerfile für die Seite liegt vor (W00) und baut in der CI (`node:26-slim` existiert). Ebenfalls **[E]**: Images werden nur auf einem CalVer-Tag `YY.M.MICRO` (z. B. `26.11.0`) in CI gebaut und in eine Registry gelegt (siehe [Branching und Release](/ops/branching-release.md)). Offen: welche Registry (Vorschlag GHCR). | [Docker](/architecture/docker.md) |
| O28 | Basis-Branch und Branch-Konvention | **[E] entschieden:** Basis ist `main`, aus dem Stand von Spezifikation und Roadmap angelegt. Konvention `feature/wNN-<kurzname>` ist ein Vorschlag **[V]**. | [Roadmap](/roadmap.md) |
| O29 | Teststrategie für externe Dienste | **[E] entschieden:** TDD mit Mocks, E2E-Tests und Contract-Tests gegen echte, gepinnte Testinstanzen. Die volle Suite läuft bei jedem PR und erneut beim Tag. Siehe [Teststrategie](/ops/testing.md). Betrifft W02, W04, W13, W14. |
| O32 | webmention.io-Test | **[E]** Werkzeuge: Vitest und Playwright. Offen: Gibt es zusätzlich einen Lesetest gegen den echten webmention.io-Dienst, obwohl er extern und möglicherweise wackelig ist? | [Teststrategie](/ops/testing.md) |
| O33 | Branch muss aktuell sein | Branch-Protection-Option gegen semantische Konflikte gleichzeitig grüner PRs. Kostet bei vielen Renovate-PRs Neuaufsetzen. Alternative: Merge Queue. Nicht entschieden. | [Teststrategie](/ops/testing.md) |
| O34 | Sichtbarkeit des Repos und CI-Minuten | Öffentliche Repos haben unbegrenzte Minuten, private nicht. Die volle Suite pro PR mit vier Containern verbraucht viel. Sichtbarkeit ist ungeklärt. | [Teststrategie](/ops/testing.md) | [Roadmap](/roadmap.md) |
| O30 | Default-Branch von GitHub | Aktuell der Sitzungs-Branch `ccr-01da7c96-avlx2l`, gewünscht `main`. Umstellung nur durch den Nutzer in den Repo-Einstellungen. | [Branching und Release](/ops/branching-release.md) |
| O31 | Auto-Updater | **[E]** Renovate als GitHub-App, Pull Requests für Fremd-Images und pnpm-Abhängigkeiten, Patch-Updates ohne Ausnahme automatisch gemergt (Minor und Major von Hand, Erweiterung auf Minor vertagt), TypeScript bei Version 6 gehalten, 3 Tage Wartezeit, kein automatisches Ziehen auf dem Server. Offen: Gruppierung der Updates, Zeitplan, ob die Wartezeit mit GitHubs Auto-Merge wirklich greift. Risiko: Auto-Merge setzt eine CI als Pflicht-Check voraus (erst ab W00), und ein Remark42-Patch kann Datenbankänderungen enthalten, deshalb Backup vor dem nächsten Tag. | [Branching und Release](/ops/branching-release.md) |
| O27 | Auslegung von "standalone" | Der Nutzer schrieb "Der Dienst sollte standalone funktionieren, wenn etwas ausgeliefert wird". Eintrag: ausgelieferte Seite läuft ohne Nextcloud, Memos und Fremddienste. Das wurde nicht ausdrücklich bestätigt. | [System](/architecture/system.md) |

# B. Inhalt und Verhalten

| ID | Thema | Eintrag / Problem |
|---|---|---|
| O4 | Remark42-Darstellung | Standardsortierung im Widget und Darstellung des Autors `admin` sind ungeprüft. Die Zeitleiste mit Mentions funktioniert nur bei Sortierung nach Zeit. |
| O6 | Anhänge, die keine Bilder sind | **[E] entschieden:** PDF, Audio und Video werden mit Größenlimit (25 MB) gespiegelt, nur für erlaubte Endungen und mit passender Dateikennung. Alles andere wird übersprungen (siehe [Medien](/content/media.md)). |
| O7 | Bildgrößen und Formate | **[E] entschieden:** Lokale Artikelbilder in mehreren Breiten (480 bis 1920) als WebP, EXIF und Farbprofil entfernt, SVG abgelehnt. Umgesetzt mit `sharp`. |
| O11 | Webmentions: Sender und Microformats | Implementierung des Senders offen. `h-entry`/`h-card`, `rel=me`, IndieAuth wurden nicht besprochen, sind für sinnvolle Anzeige aber nötig. |
| O12 | Senden aus Memos | Der Nutzer sagte "ja auf jeden Fall" für Senden und "auch für Memo-Seiten" für Mentions. Senden aus Memos ist eine Annahme. |
| O13 | Tag-Regeln | **[E] teilweise entschieden:** Tags durchgehend kleingeschrieben, auch in der Anzeige. Verschachtelte Memos-Tags (`#a/b`) bleiben ein Tag **[E]**. Tag-Seiten: Übersicht `/tag/` und Liste je Tag **[E]** (W05). Offen: zählen Inline-`#tags` in Artikeln? Gemeinsamer Namensraum für Posts und Memos ist ein Vorschlag. |
| O14 | Memo-Datum | **[E] entschieden:** `createTime` (die API hat kein `displayTime`). Titel immer aus Datum und Uhrzeit, auch bei Memos mit nur einem Bild. |
| O20 | Feed-Darstellung von Posts, RSS-Umfang | **[E teilweise]** Feed-Auszug: Beschreibung, sonst Textanfang, höchstens 200 Zeichen (W05). Offen: Anzahl RSS-Einträge, Volltext oder Auszug im RSS. |
| O21 | Zurückgezogene Artikel | **[E] entschieden:** einfach weg (404), kein gespeicherter Zustand. Offen: ob beim Zurückziehen eine Löschbenachrichtigung per Webmention gesendet wird (W15). |
| O26 | Doppelte Slugs | **[E] entschieden:** Suffix `-2`, `-3`, der ältere Artikel behält den Slug. Risiko: Kommt ein Artikel mit älterem Datum und gleichem Slug dazu, tauschen die URLs. Ein `slug:` im Frontmatter vermeidet das. |

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
| O36 | HEIC-Fotos | Handyfotos im HEIC-Format (iPhone) lassen sich mit der verwendeten Bildbibliothek nicht verarbeiten und werden mit Hinweis übersprungen. Offen: Fotos als JPEG hochladen oder eine HEIC-Verarbeitung ergänzen? |
| O37 | Codequalität, Komplexität, Mutationstests | Wunsch des Nutzers (W18): statische Analyse und später Mutationstests mit mehr als 80 %. Offen: Werkzeuge, Schwellen, blockierend oder berichtend, Umfang, Laufzeit in der CI. | [Roadmap](/roadmap.md) |
| O38 | Glossar und Graph | **[E]** Glossar als Eintragsart im selben Ordner, Markdown-Links, Graph lokal und gesamt (siehe [Glossar](/features/glossary.md)). **[E]** Feld `type: glossary`, Filter **Begriffe**, series `/terms/`, letter view `/glossary/`, Begriffe auch in Alle (gekennzeichnet), Beschriftungen Kurz und Lang statt Memos und Beiträge. Offen: Frageform des Titels mit eigenem Begriff-Feld wie im Vorbild, Kommentare und Webmentions auf Begriffen, Sortierung der Umlaute. | [Glossar](/features/glossary.md) |
| O39 | Languages | **[E]** Development in English, UI language per `MUFFEL_LANG` (de, en), no URL prefix, articles not translated, no history rewrite, English URLs (`/page/N/`, `/glossary/`, `/terms/`, `/search/`). Open: default value, feed and search texts. | [Languages](/ops/language.md) |
| O35 | Themes | **[E]** Mehrere Themes im Stil bekannter Editor-Themes (siehe [Themes](/frontend/themes.md)). **[E]** Alle zehn Themes der Vorschau bleiben, Standard ist Solarized Light. **[E]** Syntaxfarben je Theme (lowlight, beim Build), bei dunkler Systemeinstellung Solarized Dark, Schriften selbst gehostet (W06c). |

# D. Ungeprüfte Fakten (müssen vor der Umsetzung belegt werden)

* Memos: Aus dem Quellcode belegt (Version 26.11.0): öffentliche Liste und Anhänge
  sind ohne Token abrufbar, wenn der Zugriffsmodus PUBLIC ist, Pfade und Felder
  stehen in [Memos](/content/memos-source.md). Durch den Contract-Test gegen
  eine echte Instanz 26.11.0 belegt: Pfade, Feldnamen, anonymer Abruf und
  Dateiroute, außerdem dass Memos zu `#a/b` auch den Tag `a` liefert. Noch
  ungeprüft: Stabilität der `uid`, externe Anhänge.
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
