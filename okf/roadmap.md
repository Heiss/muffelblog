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
* **[E]** Ein Arbeitspaket entspricht einem Feature-Branch und einem Pull
  Request gegen `main`. Branching-Modell, Merge-Art und Release stehen in
  [Branching und Release](/ops/branching-release.md). Die Namenskonvention
  `feature/wNN-<kurzname>` ist ein Vorschlag **[V]**.
* **[V]** Die Reihenfolge folgt einem "Walking Skeleton": erst ein
  durchgängiger dünner Pfad (Artikel aus Dateien bis zur Seite), dann
  Memos, dann Client, dann Betrieb und Community.

# Globale Definition of Done

Gilt für jedes Arbeitspaket zusätzlich zu den eigenen Kriterien:

* [ ] Alle Akzeptanzkriterien des Pakets sind erfüllt und im Pull Request
  abgehakt.
* [ ] CI ist grün: Lint, Typprüfung, Unit-, E2E- und Contract-Tests,
  `astro build`. Die volle Suite läuft bei jedem Pull Request.
* [ ] Die Tests entstanden zuerst (TDD) und decken die neue Logik ab, auch
  Fehlerfälle (kaputte Eingaben, Ausfall einer Quelle). Pakete mit
  Oberfläche haben E2E-Tests. Siehe [Teststrategie](/ops/testing.md).
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
| W06a | Feed-Client: Endless Scroll, Filter, Rücksprung | W05 | W08, W09, W10, W11 |
| W06c | Themes | W06a | W08, W09, W10, W11 |
| W07 | build.json und Banner | W05, W06a | W08, W09, W10 |
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
| W18 | Codequalität, Komplexität, Mutationstests | W05; später ausbauen | W06c bis W16 |
| W19 | Glossar: Eintragsart, `/g/`, Buchstabenansicht, Feed-Filter | W05, W06a | W07 bis W11 |
| W20 | Verlinkung und Backlinks | W03, W19 | W07 bis W11 |
| W21 | Wissensgraph | W20 | W07 bis W11 |

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
  * **[E]** pnpm auf Node 26 (LTS-Linie "Lithium" laut Release-Liste vom
    2026-11-02).
  * **[E]** pnpm-Workspace mit `apps/site` (Astro), `apps/builder` (Scheduler,
    Sync, Mention-Jobs) und `packages/core` (gemeinsamer Code).
  * **[E]** ESLint und Prettier.
  * **[E]** CI mit GitHub Actions.
  * **[E]** Teststrategie (O29): TDD mit Mocks, E2E-Tests und Contract-Tests
    gegen echte, gepinnte Testinstanzen (Nextcloud, Memos, Remark42,
    Mailpit). Vitest für Unit-Tests, Playwright für E2E-Tests.
  * **[E]** Die volle Suite läuft bei jedem PR, ein Gate-Job mit
    Pfaderkennung behandelt reine Doku-PRs (siehe
    [Teststrategie](/ops/testing.md)).
  * **[E]** Renovate (GitHub-App) mit Auto-Merge für Patch-Updates und 3 Tagen
    Wartezeit, siehe [Branching und Release](/ops/branching-release.md).
* Noch offen: Registry für Docker-Images (O10), Gruppierung und Zeitplan von
  Renovate (O31), Entwicklungsablauf (O23), Branch-Protection-Option "Branch
  muss aktuell sein" (O33), Sichtbarkeit des Repos (O34).
* Umfang: Astro-Projekt mit TypeScript, Lint, Format, Test-Runner, CI,
  Dockerfile für den Build, Beispielinhalt (Fixtures).
* Befunde bei der Umsetzung:
  * Astro 7 verlangt Node 22.23.4 oder neuer. `astro check` unterstützt
    TypeScript 7 nicht, deshalb ist TypeScript auf `~6.0.3` festgelegt.
  * `astro preview` startet ohne Terminal im Hintergrund und eignet sich nicht
    als Playwright-`webServer`. Die E2E-Tests servieren `dist/` mit `sirv-cli`.
  * Corepack gehört seit Node 25 nicht mehr zur Auslieferung. Das Dockerfile
    installiert pnpm über npm in der Version aus `package.json`.
  * Das Image `node:26-slim` existiert und das Dockerfile baut: Der Job
    "Docker-Build der Seite" lief im ersten CI-Lauf auf GitHub erfolgreich
    (Lauf 41472880143). In der Entwicklungsumgebung war das wegen fehlendem
    Docker-Daemon nicht prüfbar.
  * Die Actions (`actions/checkout@v4`, `pnpm/action-setup@v4`,
    `actions/setup-node@v4`) laufen. Ob neuere Hauptversionen existieren, ist
    nicht geprüft. Renovate hebt sie an.
* DoD (Stand Umsetzung):
  * [x] `docker build` erzeugt das Astro-Projekt reproduzierbar. Der Job
    "Docker-Build der Seite" lief auf GitHub erfolgreich und prüft, dass
    `out/index.html` existiert.
  * [x] CI führt Lint, Typprüfung, Unit-Tests (Vitest), E2E-Tests
    (Playwright) und Build aus, und je Testart läuft ein Beispieltest. Der
    erste Lauf auf GitHub war grün (5 Unit-Tests, 2 E2E-Tests).
  * [ ] Ein Gate-Job mit Pfaderkennung ist der Pflicht-Check für `main`. Der
    Code-Pfad (volle Suite) lief auf GitHub grün. Der Doku-Pfad (schwere Jobs
    übersprungen, Gate grün) ist bisher nur lokal getestet, der Nachweis auf
    GitHub steht aus.
  * [x] README mit Start- und Testanleitung.
  * [ ] Die CI ist als Pflicht-Check für `main` eingetragen (Einstellung durch
    den Nutzer, Name des Checks: "CI Gate").
  * [ ] `renovate.json` ist konfiguriert (Patch-Auto-Merge, 3 Tage Wartezeit),
    die Renovate-App ist installiert, und ein Test-Update läuft durch die CI.
    Die Datei liegt vor, die App-Installation steht aus.

## W01 - Artikel-Modell und Frontmatter

* Branch: `feature/w01-frontmatter`
* Abhängig von: W00
* Entschieden (siehe [Frontmatter](/content/frontmatter.md)):
  * **[E]** Datum (O2): Reines Datum gilt als 12:00 Uhr Berlin, Uhrzeit ohne
    Zone als Berliner Ortszeit.
  * **[E]** Doppelte Slugs (O26): Suffix `-2`, `-3`, der ältere Artikel behält
    den Slug.
  * **[E]** Tags (O13): durchgehend kleingeschrieben, auch in der Anzeige.
  * **[E]** Zurückgezogene Artikel (O21): einfach weg, 404.
* Umfang: Loader für einen lokalen Markdown-Ordner, Schema nach
  [Frontmatter](/content/frontmatter.md), Slug mit Transliteration, Fallbacks,
  Ausschlüsse (siehe [Nextcloud-Quelle](/content/nextcloud-source.md)). Der
  Artikeltext wird noch nicht gerendert, das folgt in W03. Die Seiten
  `/p/<slug>/` zeigen Titel, Datum und Tags.
* DoD (Stand Umsetzung, lokal mit Node 26 belegt; der CI-Lauf steht aus):
  * [x] `publish` zählt nur als Boolean `true` (Unit-Tests mit `"true"`,
    `yes`, `1`, `false`, `null`).
  * [x] Fehlendes oder ungültiges `date` fällt auf das Änderungsdatum zurück
    und warnt.
  * [x] Eine kaputte Datei überspringt nur sich selbst und wird geloggt.
  * [x] Doppelte Slugs verhalten sich nach der gewählten Regel.
  * [x] Fixtures decken ab: gültig, ungültiges YAML, Konfliktkopie,
    Wikilink, Umlaut-Slug (außerdem Unterordner, verstecktes Verzeichnis,
    Uhrzeit mit und ohne Zone, doppelter Slug).
  * [x] Der Build erzeugt `/p/<slug>/` für die Fixtures. 14 E2E-Tests prüfen
    die erzeugten Seiten und, dass nicht veröffentlichte Artikel 404
    liefern (der Test schlägt nachweislich fehl, wenn ein Artikel zu Unrecht
    veröffentlicht wird).
* Befunde bei der Umsetzung:
  * Chromium meldet eine leere 404-Antwort bei `page.goto` als Netzwerkfehler.
    Die Prüfung auf 404 nutzt deshalb direkte HTTP-Anfragen.
  * Die Prüfung auf Wikilinks ignoriert Code-Blöcke und Inline-Code.
  * Die Muster für Nextcloud-Konfliktkopien sind weiter ungeprüft (O25, W02).

## W02 - Nextcloud-Sync

* Branch: `feature/w02-nextcloud-sync`
* Abhängig von: W00
* Entscheidungen: Sync-Werkzeug, Verhalten bei Teilausfall, Umgang mit
  gelöschten Dateien, Prüfung der ungeprüften Fakten (O25).
* Umfang: Abruf des Public Shares per WebDAV mit Token und Passwort in den
  Cache, Änderungserkennung.
* DoD:
  * [ ] Sync ist mit Mocks getestet, ein Contract-Test gegen eine echte
    Nextcloud-Testinstanz liegt vor.
  * [ ] Das Passwort kommt nur aus einem Secret.
  * [ ] Ohne Änderung wird kein Build ausgelöst.
  * [ ] Schlägt der Abruf fehl, bleibt der Cache unverändert.
  * [ ] Das Verhalten von `getlastmodified` ist dokumentiert.

## W03 - Rendering, Bereinigung, Artikel-Bilder

* Branch: `feature/w03-rendering`
* Abhängig von: W01
* Entschieden (siehe [Medien](/content/media.md)):
  * **[E]** Fremdinhalte in Artikeln (O5) sind erlaubt, aber nur aus
    Freigabelisten: Bilder von `upload.wikimedia.org`,
    `raw.githubusercontent.com` und `user-images.githubusercontent.com`,
    Einbettungen nur von `www.youtube-nocookie.com` und erst nach Klick.
    Memos bleiben strikt (Bilder gespiegelt).
  * **[E]** Lokale Artikelbilder (O7): verkleinern, WebP, EXIF entfernen.
* Umfang: Markdown-Pipeline mit HTML-Allowlist, relative Bilder aus dem
  Nextcloud-Ordner, Erkennung von Wikilink-Syntax (siehe
  [Bereinigung](/security/sanitization.md), [Medien](/content/media.md)).
* DoD (Stand Umsetzung, lokal mit Node 26 belegt; der CI-Lauf steht aus):
  * [x] Rohes HTML und Skripte im Markdown erscheinen nicht in der Ausgabe.
    Unit-Tests prüfen Skripte, Ereignis-Attribute, gefährliche Verweise,
    Formulare, Stile, SVG, Objekte und Kommentare. Schaltet man die
    Bereinigung ab, schlagen fünf Tests fehl. Ein E2E-Test prüft im Browser,
    dass nichts ausgeführt und nichts von Fremdservern geladen wird.
  * [x] Nur referenzierte Bilder gelangen in den Build. Der Auflöser erzeugt
    nur Dateien für Bilder, die ein veröffentlichter Artikel verwendet.
  * [x] Fehlende Bilder warnen, brechen aber nicht ab (Platzhalter mit
    Alt-Text).
  * [x] Wikilinks führen zu einer Warnung statt kaputtem HTML (aus W01).
  * [x] Remote-Bilder und Einbettungen nur von freigegebenen Hosts, ähnlich
    aussehende Hosts, `http`, Zugangsdaten und fremde Ports werden abgewiesen.
  * [x] Lokale Bilder: WebP in mehreren Breiten bis 1920 px, EXIF und
    Farbprofil entfernt, Ausrichtung angewandt, Pfade außerhalb des Ordners,
    versteckte Ordner, SVG und Verweise (Symlinks) aus dem Ordner heraus
    werden abgewiesen.
* Befunde bei der Umsetzung:
  * `astro build` bindet `sharp` als nativen Baustein nicht ein. Das Paket
    muss deshalb auch in `apps/site` als Abhängigkeit stehen.
  * Das Rendern von Markdown mit `<script>`, `<style>` und Verwandtem entfernt
    deren Inhalt mit (`strip` in der Bereinigung), sonst bliebe der Code als
    Text stehen.
  * Obsidian schreibt Pfade je nach Einstellung relativ zur Notiz oder ab der
    Ordnerwurzel. Der Auflöser probiert beide Wege.

## W04 - Memos-Quelle und Bild-Spiegelung

* Branch: `feature/w04-memos`
* Abhängig von: W03
* Entschieden (siehe [Memos](/content/memos-source.md)):
  * **[E]** Titel immer aus Datum und Uhrzeit.
  * **[E]** PDF, Audio und Video werden mit Größenlimit gespiegelt (O6).
  * **[E]** Alt-Text aus dem Dateinamen, `#a/b` bleibt ein Tag.
  * Memo-Datum (O14): `createTime`, weil die API kein `displayTime` hat.
* Umfang: Content-Loader für öffentliche Memos, Seiten `/m/<uid>/`, Titel und
  Description, Tags, Anhänge spiegeln (Bilder als WebP ohne EXIF; PDF, Audio,
  Video mit Dateikennung und Größenlimit), strenger Rendermodus (siehe
  [Memos](/content/memos-source.md), [Medien](/content/media.md)).
* DoD (Stand Umsetzung): lokal mit Node 26 belegt. Der Contract-Test läuft nur
  in der CI, weil hier kein Docker-Daemon verfügbar ist.
  * [x] Nur `PUBLIC`-Memos erscheinen (zusätzlich zum Filter der API wird die
    Sichtbarkeit jedes Eintrags geprüft; Tests mit PRIVATE und PROTECTED).
  * [x] Kein Link und keine Ressource zeigt auf die Memos-Instanz (Unit-Tests,
    E2E und Contract-Test prüfen das HTML).
  * [x] Gespiegelte Bilder haben keine EXIF-/GPS-Daten (gleiche Verarbeitung wie
    bei Artikelbildern).
  * [x] SVG, HTML, zu große Dateien und Dateien, deren Inhalt nicht zur Endung
    passt, werden abgewiesen; Weiterleitungen werden nicht befolgt.
  * [ ] Interne IP-Ziele werden abgelehnt. Die Basisadresse ist Konfiguration
    des Betreibers und Weiterleitungen sind gesperrt; ein allgemeiner
    SSRF-Schutz für fremde URLs folgt mit den Mention-Avataren (W14).
  * [x] Ein Abruffehler lässt vorhandene Memos nicht verschwinden: Der Build
    bricht ab, die letzte gute Version bleibt online.
  * [x] Test mit Beispielantworten in der Form der API (Fixtures und
    nachgebildete Antworten).
  * [x] Ein Contract-Test gegen eine echte Memos-Testinstanz liegt vor
    (`neosmemo/memos:26.11.0` als Service-Container, 5 Tests, in der CI grün).
    Er zeigte, dass Memos zu `#a/b` auch den Tag `a` liefert.
* Befunde bei der Umsetzung:
  * Memos hat seit 26.10.0 die Pfade `/api/...` statt `/api/v1/...`.
  * Anonymer Zugriff klappt nur, wenn der Zugriffsmodus der Instanz auf PUBLIC
    steht.
  * Der Build verlangt jetzt ausdrücklich `CONTENT_DIR` und `MEMOS_URL`.
    Beispieldaten gibt es nur mit `MUFFEL_FIXTURES=1`; der Befehl `pnpm build`
    im Repo-Root setzt das, der echte Build ist `pnpm build:site`.

## W05 - Statischer Feed, Blöcke, Tags, Sitemap

* Branch: `feature/w05-feed-statisch`
* Abhängig von: W01, W04
* Entschieden:
  * **[E]** Blockgröße 20 Einträge (O1).
  * **[E]** Auszug eines Artikels: Beschreibung, sonst Textanfang (höchstens
    200 Zeichen, an der Wortgrenze gekürzt). Memos erscheinen vollständig (O20).
  * **[E]** Tag-Seiten: Übersicht `/tag/` und je Tag eine Liste `/tag/<tag>/`
    mit Blöcken `/tag/<tag>/seite/N/` (O13).
* Umfang: Startseite, technische Blöcke `/seite/N/` in drei Reihen
  (`/`, `/memos/`, `/posts/`), `noindex, follow` ab Seite 2, Canonical (nur mit
  `SITE_URL`), Tag-Seiten, Sitemap (nur mit `SITE_URL`), siehe
  [Feed](/frontend/feed.md) und [URLs und SEO](/frontend/urls-seo.md).
* DoD:
  * [x] Posts und Memos erscheinen gemeinsam, rein chronologisch (Unit-Test
    und E2E über alle Blöcke, ohne Doppelungen).
  * [x] `/seite/N/` ist nicht in der Sitemap. Pagefind kommt in W08, dort ist
    `data-pagefind-ignore` für die Blöcke nachzuziehen.
  * [x] Seite 1 hat keine eigene Route: `/seite/1/` gibt 404, die erste Seite
    ist `/`. Damit entfällt der Canonical von `/seite/1/` auf `/`.
  * [x] Ohne JavaScript führt der Weiter-Link durch alle Einträge (E2E mit
    abgeschaltetem JavaScript). Ein `<noscript>`-Link ist unnötig, weil die
    Links normale Anker sind.
  * [x] Seiten haben `lang="de"`.
* Befunde bei der Umsetzung:
  * Der Test-Build nutzt Blöcke zu 4 Einträgen (`MUFFEL_FEED_PAGE_SIZE=4`, siehe
    [Konfiguration](/ops/config.md)), sonst hätten die 15 Beispieleinträge nur
    eine Seite.
  * Ohne `SITE_URL` (Domain offen, O9) gibt es weder Sitemap noch Canonical.
    Mit `SITE_URL` entstehen beide, lokal geprüft, aber nicht in der CI.
  * Tags, deren URL-Form gleich ist (`a/b` und `a-b`), teilen sich eine Seite.
  * Artikelseiten `/p/<slug>/` und Memo-Seiten nutzen das neue Grundlayout
    noch nicht (Navigation fehlt dort), das folgt mit W06/W10.

## W06 - Feed-Client (in zwei Pull Requests)

* Entschieden **[E]**: Zuschnitt in zwei Pull Requests W06a (Endless Scroll,
  Filter, Rücksprung) und W06c (Themes). **W06b (Split-View) entfällt** auf
  Wunsch des Nutzers (2026-11-03): Unified mit Filter genügt, die Split-View
  wäre zusätzliche Komplexität.
* Entschieden **[E]**: Ein Filterwechsel baut die Liste neu auf und springt nach
  oben. Der Filter bleibt erhalten.
* Entschieden **[E]**: Ohne gespeicherte Wahl nimmt die Seite bei dunkler
  Systemeinstellung Solarized Dark, sonst Solarized Light. Eine gespeicherte
  Wahl gewinnt.

### W06a - Endless Scroll, Filter, Rücksprung

* Branch: `feature/w06-feed-client`
* Abhängig von: W05
* Umfang: Nachladen per `IntersectionObserver`, Filter Alle / Beiträge / Memos
  im Unified-Modus, Speicherung des Filters, Wiederherstellen von Blöcken und
  Scrollposition beim Rücksprung.
* DoD:
  * [x] Endless Scroll lädt Blöcke nach, ohne Doppelungen (E2E über alle
    4 Blöcke, Reihenfolge geprüft).
  * [x] Ohne JavaScript bleiben Weiter-Link und Filter normale Links.
  * [x] Ohne nutzbaren `localStorage` gelten Standardwerte.
  * [x] Zurück-Navigation stellt geladene Blöcke und Scrollposition wieder
    her.
  * [x] Nachladefehler zeigen einen Hinweis mit normalem Link als Ausweg.
  * [x] Nachgeladen werden nur Adressen der eigenen Seite in der Form der
    Blöcke (Unit-Test für die Prüfung).
* Befunde bei der Umsetzung:
  * Der Filter ändert die Adresse per `replaceState` auf die Reihe
    (`/memos/`, `/posts/`, `/`). Ein Neuladen von `/memos/` zeigt dann
    dieselbe Liste. Auf `/` gewinnt ein gespeicherter Filter, eine
    ausdrücklich aufgerufene Reihe nicht. Beim Aufruf von `/` mit gespeichertem
    Filter erscheint kurz der gemischte Strom, bevor er ersetzt wird.
  * Mit JavaScript ist der Pager (auch "Neuere Einträge") verborgen.

### W06c - Themes

* Branch: `feature/w06c-themes`
* Abhängig von: W06a
* DoD:
  * [ ] Alle zehn Themes sind wählbar, Solarized Light ist der Standard.
  * [ ] Jedes Theme besteht den Kontrasttest (Text mindestens 4,5:1), und das
    gewählte Theme bleibt nach dem Neuladen erhalten, ohne dass beim Laden
    kurz das falsche Theme aufblitzt.
  * [ ] Die Bilder der README sind mit dem neuen Aussehen neu aufgenommen
    (`pnpm screenshots`, Entwurf-PR #19, auf Wunsch des Nutzers erst nach W06c
    gemergt).

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
  * [ ] Ein Contract-Test gegen eine echte Remark42-Testinstanz mit Mail-Sink
    liegt vor.

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
  * [ ] Das Posten und Löschen von Mentions als `admin` ist gegen die echte
    Remark42-Testinstanz im Contract-Test abgesichert.

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
  * [ ] Der Tag-Workflow führt die volle Suite erneut aus und veröffentlicht
    bei Rot keine Images.

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

## W18 - Codequalität, Komplexität, Mutationstests

* Branch: `feature/w18-qualitaet`
* Abhängig von: W05 (genug Code zum Messen); bewusst nicht am Anfang
* Anlass: Der Nutzer wünscht statische Analyse (Codequalität, Komplexität) und
  später Mutationstests mit mehr als 80 %, damit der Code zu den TDD-Tests
  passt.
* Entscheidungen (offen, O37): Werkzeuge, Schwellen für Komplexität, ob die
  Analyse die CI blockiert oder nur berichtet, Umfang und Laufzeit der
  Mutationstests (alle Pakete oder nur `packages/core`), Zeitpunkt der
  Einführung der 80-%-Schwelle.
* DoD (Entwurf, **[V]**):
  * [ ] Komplexitätsgrenzen sind in der Lint-Konfiguration gesetzt und die CI
    prüft sie.
  * [ ] Ein Bericht zur Codequalität liegt vor, bestehende Befunde sind
    behoben oder bewusst akzeptiert.
  * [ ] Mutationstests laufen für die gewählten Pakete, der Mutation Score
    liegt bei mindestens 80 %, überlebende Mutanten sind bewertet.
  * [ ] Laufzeit und CI-Kosten sind gemessen (siehe O34), der Lauf blockiert
    Pull Requests nicht unnötig lange.

## W19 - Glossar

* Branch: `feature/w19-glossar`
* Abhängig von: W05, W06a
* Entscheidungen (O38): Feldname und Wert von `typ`, Begriff-Feld und
  Frageform des Titels, Pfad der Block-Reihe, Sortierung der Umlaute,
  Kommentare auf Begriffen.
* Umfang: Eintragsart `glossar` im Loader, Seiten `/g/<slug>/`, Buchstabenansicht
  `/glossar/`, dritte Art im Feed mit Filter, Aufnahme in Sitemap (siehe
  [Glossar](/features/glossary.md)). Suche und RSS folgen in W08 und W09.
* DoD (Entwurf, **[V]**):
  * [ ] Eine Datei mit `typ: glossar` und `publish: true` erzeugt `/g/<slug>/`;
    ohne `typ` bleibt sie ein Artikel.
  * [ ] Begriffe erscheinen im Feed in zeitlicher Reihenfolge und sind filterbar.
  * [ ] `/glossar/` gruppiert nach Buchstaben des Begriffs, Umlaute unter dem
    Grundbuchstaben, die Leiste besteht aus echten Links.
  * [ ] Doppelte Slugs im Glossar bekommen einen Zähler und stören `/p/` nicht.
  * [ ] Ohne JavaScript ist alles erreichbar.

## W20 - Verlinkung und Backlinks

* Branch: `feature/w20-verlinkung`
* Abhängig von: W03, W19
* Umfang: Auflösung relativer Markdown-Links auf veröffentlichte Dateien zu
  Seiten, Warnung bei toten Links, Kantenliste, Listen "Verweist auf" und
  "Verlinkt von" auf Artikel- und Begriffsseiten.
* DoD (Entwurf, **[V]**):
  * [ ] Ein Link mit relativem Dateipfad als Ziel führt zur Seite des Ziels, auch bei `%20` und
    zerlegten Umlauten im Pfad.
  * [ ] Links auf nicht veröffentlichte oder unbekannte Dateien werden zu Text
    mit Warnung, nie zu einem Link.
  * [ ] Backlinks erscheinen als HTML-Liste, ohne Selbstbezug und Doppelte.
  * [ ] Memos erscheinen weder als Quelle noch als Ziel.

## W21 - Wissensgraph

* Branch: `feature/w21-graph`
* Abhängig von: W20
* Entscheidungen: Schwellwert für die Größe von `graph.json`, Layout,
  Bedienung per Tastatur.
* DoD (Entwurf, **[V]**):
  * [ ] Der Build schreibt `graph.json` nur mit veröffentlichten Knoten.
  * [ ] Lokaler Graph je Seite und Gesamtansicht `/graph/`, gezeichnet ohne
    Fremdbibliothek und ohne Anfrage an Dritte.
  * [ ] Jeder Knoten ist per Tastatur erreichbar, die Backlink-Listen bleiben
    der Zugang ohne JavaScript.
