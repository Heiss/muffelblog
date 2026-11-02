---
type: Data Source
title: Memos-Quelle
description: Abruf öffentlicher Memos zur Build-Zeit und Erzeugung eigener Memo-Seiten.
tags: [memos, build, microblog]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
sources:
  - id: memos-proto
    resource: https://github.com/usememos/memos/tree/main/proto/api
    title: Memos API (Protobuf-Definitionen)
  - id: memos-changelog
    resource: https://raw.githubusercontent.com/usememos/memos/main/proto/api/CHANGELOG.md
    title: Memos API Changelog
  - id: memos-access
    resource: https://raw.githubusercontent.com/usememos/memos/main/server/api/memo_service.go
    title: Memos Zugriffsprüfung beim Auflisten
---

# Entscheidungen

* **[E]** Alle Memos sind öffentlich lesbar (`PUBLIC`). Es werden nur öffentliche
  Memos verwendet.
* **[E]** Memos werden zur Build-Zeit geholt. Jede Memo hat eine eigene Seite
  `/m/<uid>/`, siehe [URLs und SEO](/frontend/urls-seo.md).
* **[E]** Links zeigen nur auf die eigenen Seiten, nie auf die Memos-Instanz.
* **[E]** Bilder werden gespiegelt (siehe [Medien](/content/media.md)).
* **[E]** Memos erscheinen vollständig mit Bildern im Feed.
* **[E]** Menge: ca. 2 Memos pro Monat.
* **[E]** Es läuft die jeweils neueste Memos-Version. Eigene Kommentare auf der
  Memos-Instanz werden nicht verwendet.
* **[E]** Titel (O14): immer Datum und Uhrzeit, zum Beispiel "Memo vom
  2. Nov. 2026, 14:32" (Europe/Berlin).
* **[E]** Andere Anhänge (O6): PDF, Audio und Video werden mit Größenlimit
  gespiegelt, alles andere nicht (siehe [Medien](/content/media.md)).
* **[E]** Alt-Text von Bildern: Dateiname ohne Endung.
* **[E]** Verschachtelte Tags (`#a/b`) bleiben ein Tag `a/b`, die URL-Form ist
  `a-b`.

# API (aus dem Quellcode belegt, Version 26.11.0)

* Die REST-Pfade heißen seit 26.10.0 `/api/...` (vorher `/api/v1/...`).[^memos-proto]
  Das Changelog warnt vor Brüchen zwischen Versionen.[^memos-changelog]
* Liste: `GET /api/memos` mit `page_size`, `page_token`, `filter` (CEL, zum
  Beispiel `visibility == "PUBLIC"`) und `order_by` (`create_time desc`).
  Antwort: `memos` und `nextPageToken`. Felder in lowerCamelCase.[^memos-proto]
* Anhang-Datei: `GET /file/attachments/<uid>/<dateiname>`.[^memos-proto]
* Ein Memo hat `name` (`memos/<uid>`), `content`, `visibility`, `state`,
  `tags` (aus dem Text extrahiert), `attachments` und `createTime`. Es gibt
  **kein** `displayTime`, deshalb ist `createTime` das Datum.[^memos-proto]
* Ohne Anmeldung liefert die Instanz nur dann Memos, wenn ihr Zugriffsmodus
  (`ACCESS`) auf `PUBLIC` steht. Dann sieht ein anonymer Aufrufer nur
  `PUBLIC`-Memos, und die Dateiroute liefert ihre Anhänge. Bei `PRIVATE` antwortet
  die Instanz mit "nicht angemeldet".[^memos-access]
* Memos hat Webhooks pro Benutzer. Der Builder braucht sie nicht, er prüft alle
  3 Minuten per Polling.[^memos-proto]

# Umsetzung

* `packages/core/src/memos.ts`: `createHttpMemosSource` (Abruf ohne Anmeldung,
  Weiterleitungen werden nie befolgt, Zeitlimit, Seitentoken-Schutz) und
  `buildMemoEntries` (Seitendaten, Anhänge spiegeln).
* **[E]** Ein Abruffehler (Netz, Serverfehler, kaputte Antwort, Anmeldepflicht)
  wirft und bricht den Build ab, die letzte gute Version bleibt online. Ein
  teilweises Ergebnis gibt es nie. Ein einzelner unbrauchbarer Eintrag oder
  ein fehlender Anhang (HTTP 404) wird übersprungen und gemeldet.
* **[E]** Der Build verlangt `CONTENT_DIR` und `MEMOS_URL`. Fehlt eine, bricht er
  ab. Beispieldaten gibt es nur mit `MUFFEL_FIXTURES=1`, damit ein Fehler in der
  Konfiguration nie Beispielinhalt veröffentlicht.
* Memos, die nicht `PUBLIC` sind, archiviert sind oder ein `parent` haben
  (Kommentare), werden zusätzlich zum Filter der API verworfen.
* Der Text läuft durch dieselbe Bereinigung wie Artikel, aber im strengen Modus:
  Remote-Bilder und Einbettungen werden immer entfernt.
* Beschreibung: Klartext des Memos, höchstens 160 Zeichen, an einer Wortgrenze
  gekürzt. Ohne Text bleibt sie leer.
* Tags kommen aus dem Feld `tags` der API und werden wie alle Tags
  kleingeschrieben.
* Die Seitenreihenfolge ist neueste zuerst.

# Offene Punkte

* **[U]** Ob `tags` verschachtelte Tags wie `a/b` unverändert liefert, prüft der
  Contract-Test gegen eine echte Instanz (siehe [Teststrategie](/ops/testing.md)).
* **[U]** Stabilität der `uid` über die Zeit ist nicht belegt.
* **[U]** Das Verhalten von Anhängen, die extern gespeichert sind (`externalLink`),
  auf der Dateiroute ist nicht belegt. Der Builder lädt sie nicht.
* HEIC-Fotos (iPhone) werden nicht verarbeitet, die Bibliothek für Bilder
  dekodiert sie nicht (O36).

# Löschen und Zurückstufen

Ein Memo, das nicht mehr öffentlich oder gelöscht ist, fehlt im nächsten Build.
Besuchern mit offenen Tabs, Browser-Caches und Suchmaschinen bleiben Kopien.
Bricht der Abruf ab, darf das Memo nicht als gelöscht gelten (siehe
[Pipeline](/ops/pipeline.md)).

[^memos-proto]: Memos API (Protobuf-Definitionen)
[^memos-changelog]: Memos API Changelog
[^memos-access]: Memos Zugriffsprüfung beim Auflisten
