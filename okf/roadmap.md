---
type: Roadmap
title: Roadmap und Definition of Done
description: Arbeitspakete mit Abhängigkeiten, Entscheidungsbedarf und Abnahmekriterien für den schrittweisen Aufbau auf Feature-Branches.
tags: [roadmap, planung, definition-of-done]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T13:10:00Z }
---

# Vorgehen

* **[E]** Das System wird schrittweise auf Feature-Branches aufgebaut.
* **[E]** Entscheidungen trifft der Nutzer unterwegs. Zu jeder Entscheidung
  werden 3 bis 5 Optionen vorgelegt. Die Optionen kommen beim Start des
  jeweiligen Arbeitspakets, nicht vorab.
* **[E]** Live geht das System, wenn alle Arbeitspakete fertig sind (W17).
* **[V]** Ein Arbeitspaket entspricht einem Feature-Branch
  `feature/wNN-<kurzname>` und einem Pull Request. Basis-Branch und
  Namenskonvention sind offen (O28).
* **[V]** Die Reihenfolge folgt einem "Walking Skeleton": erst ein
  durchgängiger dünner Pfad (Artikel aus Dateien bis zur Seite), dann
  Memos, dann Client, dann Betrieb und Community.

# Globale Definition of Done

Gilt für jedes Arbeitspaket zusätzlich zu den eigenen Kriterien:

* [ ] Alle Akzeptanzkriterien des Pakets sind erfüllt und im Pull Request
  abgehakt.
* [ ] CI ist grün: Lint, Typprüfung, Tests, `astro build`.
* [ ] Tests decken die neue Logik ab, auch Fehlerfälle (kaputte Eingaben,
  Ausfall einer Quelle).
* [ ] Es sind keine Secrets im Repo (Secret-Scan ohne Treffer).
* [ ] Der Browser lädt keine Fremdressourcen (Netzwerk- oder CSP-Test).
* [ ] Die Entscheidungen des Pakets sind mit Optionen und Wahl im OKF-Bundle
  festgehalten, `[U]`-Punkte sind geprüft und auf `[E]` oder `[V]` gesetzt,
  `log.md` und `open-points.md` sind aktualisiert.
* [ ] Der Nutzer hat den Pull Request abgenommen.

# Abhängigkeiten

| Paket | Thema | Hängt ab von | Parallel zu |
|---|---|---|---|
| W00 | Fundament | - | - |
| W01 | Artikel-Modell und Frontmatter | W00 | W11 |
| W02 | Nextcloud-Sync | W00 | W01, W03 |
| W03 | Rendering, Bereinigung, Artikel-Bilder | W01 | W02 |
| W04 | Memos-Quelle und Bild-Spiegelung | W03 | W11 |
| W05 | Statischer Feed, Blöcke, Tags, Sitemap | W01, W04 | W11 |
| W06 | Feed-Client (Scroll, Filter, Split-View) | W05 | W08, W09, W10, W11 |
| W07 | build.json und Banner | W05, W06 | W08, W09, W10 |
| W08 | Suche (Pagefind) | W05 | W06, W09, W10 |
| W09 | RSS | W05 | W06, W08, W10 |
| W10 | SEO, Microformats, statische Seiten | W05 | W06, W08, W09 |
| W11 | Docker-Gerüst | W00 | W01 bis W10 |
| W12 | Build-Pipeline und Scheduler | W02, W04, W11 | W06 bis W10 |
| W13 | Kommentare (Remark42) | W05, W11, W12 | W07 bis W10 |
| W14 | Webmentions Empfang und Anzeige | W13, W10; **Domain** | - |
| W15 | Webmentions Senden | W14 | - |
| W16 | Härtung und Betrieb | W12, W13, W14, W15 | - |
| W17 | Go-live | alle | - |

**Kritischer Pfad:** W00, W01, W03, W04, W05, W12, W13, W14, W15, W16, W17.

**Externe Blocker**
* **Domain:** spätestens vor W14 nötig (`rel=me`, IndieAuth, Webmention-Ziele,
  absolute URLs). Davor reicht eine Testdomain (O9, O29).
* **Testinstanzen:** Für W02, W04, W13 und W14 braucht es Nextcloud, Memos,
  Remark42 und einen Mail-Sink als Testumgebung oder Mocks (O29).

# Arbeitspakete

## W00 - Fundament

* Branch: `feature/w00-fundament`
* Abhängig von: -
* Entschieden:
  * **[E]** Basis-Branch ist `main`, angelegt aus dem Stand von Spezifikation
    und Roadmap. Feature-Branches zweigen von `main` ab, Pull Requests gehen
    gegen `main` (O28).
  * **[E]** pnpm auf Node LTS.
  * **[E]** CI mit GitHub Actions.
  * **[E]** Teststrategie hybrid (O29): Mocks und Beispielantworten in CI,
    lokale Compose-Umgebung mit echten Testinstanzen (Nextcloud, Memos,
    Remark42, Mailpit) für Integrationsprüfungen.
* Noch offen: genaue Node-Version, Test-Framework, Lint-Werkzeuge,
  Registry für Docker-Images (O10), Entwicklungsablauf (O23).
* Umfang: Astro-Projekt mit TypeScript, Lint, Format, Test-Runner, CI,
  Dockerfile für den Build, Beispielinhalt (Fixtures).
* DoD:
  * [ ] `docker build` erzeugt das Astro-Projekt reproduzierbar.
  * [ ] CI führt Lint, Typprüfung, Tests und Build aus.
  * [ ] README mit Start- und Testanleitung.

## W01 - Artikel-Modell und Frontmatter

* Branch: `feature/w01-frontmatter`
* Abhängig von: W00
* Entscheidungen: Datumsformat und Zeitzone (O2), doppelte Slugs (O26),
  Tag-Regeln (O13), Zurückziehen von Artikeln (O21).
* Umfang: Loader für einen lokalen Markdown-Ordner, Schema nach
  [Frontmatter](/content/frontmatter.md), Slug mit Transliteration, Fallbacks,
  Ausschlüsse (siehe [Nextcloud-Quelle](/content/nextcloud-source.md)).
* DoD:
  * [ ] `publish` zählt nur als Boolean `true`.
  * [ ] Fehlendes oder ungültiges `date` fällt auf das Änderungsdatum zurück
    und warnt.
  * [ ] Eine kaputte Datei überspringt nur sich selbst und wird geloggt.
  * [ ] Doppelte Slugs verhalten sich nach der gewählten Regel.
  * [ ] Fixtures decken ab: gültig, ungültiges YAML, Konfliktkopie,
    Wikilink, Umlaut-Slug.
  * [ ] Der Build erzeugt `/p/<slug>/` für die Fixtures.

## W02 - Nextcloud-Sync

* Branch: `feature/w02-nextcloud-sync`
* Abhängig von: W00
* Entscheidungen: Sync-Werkzeug, Verhalten bei Teilausfall, Umgang mit
  gelöschten Dateien, Prüfung der ungeprüften Fakten (O25).
* Umfang: Abruf des Public Shares per WebDAV mit Token und Passwort in den
  Cache, Änderungserkennung.
* DoD:
  * [ ] Sync gegen eine echte oder nachgebildete Nextcloud-Instanz getestet.
  * [ ] Das Passwort kommt nur aus einem Secret.
  * [ ] Ohne Änderung wird kein Build ausgelöst.
  * [ ] Schlägt der Abruf fehl, bleibt der Cache unverändert.
  * [ ] Das Verhalten von `getlastmodified` ist dokumentiert.

## W03 - Rendering, Bereinigung, Artikel-Bilder

* Branch: `feature/w03-rendering`
* Abhängig von: W01
* Entscheidungen: Fremdinhalte (O5), Bildgrößen und Formate (O7).
* Umfang: Markdown-Pipeline mit HTML-Allowlist, relative Bilder aus dem
  Nextcloud-Ordner, Erkennung von Wikilink-Syntax (siehe
  [Bereinigung](/security/sanitization.md), [Medien](/content/media.md)).
* DoD:
  * [ ] Rohes HTML und Skripte im Markdown erscheinen nicht in der Ausgabe.
  * [ ] Nur referenzierte Bilder gelangen in den Build.
  * [ ] Fehlende Bilder warnen, brechen aber nicht ab.
  * [ ] Wikilinks führen zu einer Warnung statt kaputtem HTML.

## W04 - Memos-Quelle und Bild-Spiegelung

* Branch: `feature/w04-memos`
* Abhängig von: W03
* Entscheidungen: Memo-Datum (O14), Nicht-Bild-Anhänge (O6), Versionspflege
  (O8), Prüfung der Memos-API (O25).
* Umfang: Content-Loader für öffentliche Memos, Seiten `/m/<uid>/`, Titel und
  Description aus dem Text, Inline-Tags, Bilder spiegeln mit EXIF-Entfernung,
  Typ-, Größen- und SSRF-Schutz (siehe [Memos](/content/memos-source.md)).
* DoD:
  * [ ] Nur `PUBLIC`-Memos erscheinen.
  * [ ] Kein Link und keine Ressource zeigt auf die Memos-Instanz.
  * [ ] Gespiegelte Bilder haben keine EXIF-/GPS-Daten.
  * [ ] SVG, zu große Dateien und interne IP-Ziele werden abgelehnt.
  * [ ] Ein Abruffehler lässt vorhandene Memos nicht verschwinden.
  * [ ] Test mit einer Beispielantwort der API-Version.

## W05 - Statischer Feed, Blöcke, Tags, Sitemap

* Branch: `feature/w05-feed-statisch`
* Abhängig von: W01, W04
* Entscheidungen: Blockgröße und Pfade (O1), Tag-Seiten, Grundlayout (O16).
* Umfang: Startseite, technische Blöcke `/seite/N/` in drei Reihen,
  `noindex, follow`, Canonical, `<noscript>`-Link, Tag-Seiten, Sitemap (siehe
  [Feed](/frontend/feed.md), [URLs und SEO](/frontend/urls-seo.md)).
* DoD:
  * [ ] Posts und Memos erscheinen gemeinsam, rein chronologisch.
  * [ ] `/seite/N/` ist weder in der Sitemap noch in Pagefind.
  * [ ] `/seite/1/` verweist per Canonical auf `/`.
  * [ ] Ohne JavaScript führt der Weiter-Link durch alle Einträge.
  * [ ] Seiten haben `lang="de"`.

## W06 - Feed-Client

* Branch: `feature/w06-feed-client`
* Abhängig von: W05
* Entscheidungen: Gestaltung (O16), Verhalten bei Tastatur und Screenreader.
* Umfang: Endless Scroll, Filter im Unified-Modus, Split-View ab 1024px mit
  verschiebbarem Balken und ausblendbaren Seiten, Zustand im Browser.
* DoD:
  * [ ] Endless Scroll lädt Blöcke nach, ohne Doppelungen.
  * [ ] Ab 1024px lassen sich Modus, Verhältnis und ausgeblendete Seite
    umschalten und bleiben nach dem Neuladen erhalten.
  * [ ] Unter 1024px gibt es nur Unified mit Filter.
  * [ ] Ohne `localStorage` gelten Standardwerte.
  * [ ] Der Balken ist per Tastatur bedienbar.
  * [ ] Zurück-Navigation stellt die Scrollposition wieder her.

## W07 - build.json und Banner

* Branch: `feature/w07-build-json`
* Abhängig von: W05, W06
* Entscheidungen: Anzahl der Einträge in `build.json`, Abfrageintervall,
  Banner-Gestaltung.
* DoD:
  * [ ] `build.json` wird als letzte Datei eines Builds geschrieben.
  * [ ] Bedingte Abfragen antworten mit 304.
  * [ ] Das Banner zählt nur Einträge, die neuer sind als der neueste
    geladene.
  * [ ] Ein Klick scrollt nach oben und zeigt die neuen Einträge.
  * [ ] Das Banner erscheint nicht, wenn sich nur Kommentare ändern.
  * [ ] Es wird nur bei sichtbarem Tab abgefragt.

## W08 - Suche (Pagefind)

* Branch: `feature/w08-suche`
* Abhängig von: W05
* Entscheidungen: Oberfläche (O16), Prüfung der deutschen Texte (O25).
* DoD:
  * [ ] Posts und Memos sind auffindbar, Filter nach Typ und Tag.
  * [ ] Technische Blöcke sind nicht im Index, keine doppelten Treffer.
  * [ ] Suche funktioniert ohne Fremdrequests.

## W09 - RSS

* Branch: `feature/w09-rss`
* Abhängig von: W05
* Entscheidungen: Umfang und Auszug (O20), Domain-Platzhalter bis zur
  Festlegung.
* DoD:
  * [ ] `/feed.xml` ist valide und kombiniert Posts und Memos.
  * [ ] GUIDs sind stabil, unabhängig von Datum und Domain.
  * [ ] Der Feed enthält keine Kommentare und Mentions.

## W10 - SEO, Microformats, statische Seiten

* Branch: `feature/w10-seo`
* Abhängig von: W05
* Entscheidungen: Open Graph (O17), Microformats (O11), Impressum und
  Datenschutz (O15), 404 und `robots.txt` (O24).
* DoD:
  * [ ] Jede Seite hat Title, Description und Canonical.
  * [ ] Post- und Memo-Seiten tragen gültige `h-entry`-Auszeichnung.
  * [ ] Statische Seiten wie Impressum sind veröffentlichbar.
  * [ ] 404-Seite und `robots.txt` existieren.

## W11 - Docker-Gerüst

* Branch: `feature/w11-docker`
* Abhängig von: W00
* Entscheidungen: Reverse-Proxy (O9), Image-Build (O10), Versionen (O8).
* Umfang: Compose mit `web`, `builder`, `remark42` als Platzhalter, Volumes,
  Secrets, Caddy-Regeln, Healthchecks (siehe [Docker](/architecture/docker.md)).
* DoD:
  * [ ] `docker compose up` startet alle Dienste in einer Testumgebung.
  * [ ] Secrets stammen aus Secrets oder `.env`, nicht aus dem Repo.
  * [ ] Die Auslieferung nutzt einen Symlink auf das aktuelle Release.
  * [ ] Caddy lehnt Basic-Auth auf den Remark42-Routen von außen ab.
  * [ ] CSP ohne Fremdquellen ist gesetzt.

## W12 - Build-Pipeline und Scheduler

* Branch: `feature/w12-pipeline`
* Abhängig von: W02, W04, W11
* Entscheidungen: Debounce-Zeit, Anzahl behaltener Releases, Meldekanal für
  Fehler (O18).
* DoD:
  * [ ] Alle 3 Minuten wird auf Änderungen geprüft, ohne Änderung kein Build.
  * [ ] Release-Austausch ist atomar, `build.json` kommt zuletzt.
  * [ ] Bei Abruffehler bleibt die letzte gute Version online.
  * [ ] Frühere Releases bleiben für offene Tabs erhalten.
  * [ ] Ein fehlgeschlagener Build wird gemeldet.

## W13 - Kommentare (Remark42)

* Branch: `feature/w13-kommentare`
* Abhängig von: W05, W11, W12
* Entscheidungen: Hostname und Pfad (O9), Sortierung und Darstellung (O4),
  Moderation (O22), Datenschutz (O15).
* DoD:
  * [ ] Login nur per E-Mail, die Mail kommt über Migadu an (in einer
    Testumgebung mit Mail-Sink).
  * [ ] Das Widget lädt nur vom eigenen Host.
  * [ ] Die statische Kopie der Kommentare ist bereinigt und ohne JavaScript
    sichtbar.
  * [ ] Ohne Anmeldung kann nicht kommentiert werden.
  * [ ] Kommentare sind auf Posts und Memos möglich.
  * [ ] Daten von Remark42 sind gesichert (Volume, Backup-Test).

## W14 - Webmentions: Empfang und Anzeige

* Branch: `feature/w14-webmentions-empfang`
* Abhängig von: W13, W10, Domain
* Entscheidungen: Zustand und Wiederherstellung (O3), Kommentartext,
  Prüfung der webmention.io-API (O25).
* DoD:
  * [ ] `rel=webmention` und `rel=me` sind gesetzt.
  * [ ] Neue Mentions erscheinen als Kommentar in der Zeitleiste der Zielseite.
  * [ ] Mentions werden nie doppelt gepostet, auch nach Verlust des Zustands.
  * [ ] Mention-Text ist als Text bereinigt, kein HTML.
  * [ ] Avatar-Spiegelung hat SSRF- und Größenschutz oder entfällt.
  * [ ] Fällt webmention.io aus, bleiben vorhandene Mentions sichtbar.

## W15 - Webmentions: Senden

* Branch: `feature/w15-webmentions-senden`
* Abhängig von: W14
* Entscheidungen: Senden aus Memos (O12), Sender-Implementierung (O11).
* DoD:
  * [ ] Gesendet wird erst nach der Auslieferung des neuen Builds.
  * [ ] Gesendete Paare sind gespeichert, Rebuilds senden nicht erneut.
  * [ ] Änderungen und Löschungen lösen eine erneute Benachrichtigung aus.
  * [ ] Zeitlimits und Fehlerbehandlung für fremde Server.

## W16 - Härtung und Betrieb

* Branch: `feature/w16-haertung`
* Abhängig von: W12, W13, W14, W15
* Entscheidungen: Backup-Ziel und Rhythmus, Alert-Kanal (O18), Statistik
  (O19).
* DoD:
  * [ ] Backup und Restore von Remark42 und Zustand sind getestet.
  * [ ] Security-Review (Secrets, SSRF, Sanitizing, Header) ohne offene
    Befunde.
  * [ ] Laufbuch für Störungen (Quelle nicht erreichbar, Build kaputt,
    Domainwechsel).
  * [ ] Alle `[U]`-Punkte im Bundle sind geprüft oder bewusst akzeptiert.

## W17 - Go-live

* Branch: `feature/w17-golive`
* Abhängig von: alle
* Entscheidungen: Domain und DNS (O9), SPF/DKIM/DMARC, Umgang mit alten
  Mentions beim ersten Lauf, Veröffentlichung der ersten Inhalte.
* DoD:
  * [ ] Domain, TLS und DNS sind eingerichtet, Login-Mails sind zustellbar.
  * [ ] Impressum und Datenschutz sind veröffentlicht (O15).
  * [ ] Erster Echtlauf mit den echten Quellen ist erfolgreich.
  * [ ] Alle offenen Punkte in `open-points.md` sind entschieden oder
    bewusst vertagt.
