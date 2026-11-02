---
type: Schema
title: Frontmatter-Schema für Artikel
description: Pflichtfelder, Fallbacks und Verarbeitungsregeln des YAML-Frontmatters der Markdown-Artikel.
tags: [frontmatter, obsidian, tags, slug]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Felder

| Feld | Typ | Pflicht | Regel |
|---|---|---|---|
| `publish` | boolean | **[E]** ja | Nur der Boolean `true` zählt. `"true"` oder `yes` zählen nicht. Fehlt es, wird die Datei ignoriert. |
| `date` | Datum/Zeit | **[E]** ja, mit Fallback | Fehlt oder ist ungültig: Änderungsdatum der Datei. |
| `title` | Text | **[V]** ja | Fehlt es, wird es aus dem Dateinamen abgeleitet. |
| `slug` | Text | **[V]** nein | Fehlt er, wird er aus dem Dateinamen abgeleitet. |
| `description` | Text | **[V]** nein | Meta-Description, Feed-Auszug. |
| `tags` | Liste | **[V]** nein | Obsidian-Properties, Listen von Strings. Dass es Tags gibt, ist **[E]**. |

Unbekannte Felder (`aliases`, `cssclasses` und weitere) werden ignoriert.

# Datum

* **[E]** `date` ist Pflichtfeld. Fehlt es, gilt das Änderungsdatum der Datei
  als Fallback.
* **[U]** Per WebDAV ist nur `getlastmodified` verfügbar, kein
  Erstellungsdatum. Das Änderungsdatum wird bei jeder Bearbeitung neu gesetzt.
  Posts ohne `date` springen dadurch in der Chronologie und erscheinen im RSS
  erneut als neu, wenn die GUID am Datum hängt.
* **[V]** Die RSS-GUID hängt deshalb nicht am Datum (siehe
  [RSS](/features/rss.md)).
* **[E]** Format und Zeitzone (O2): Erlaubt sind ein reines Datum und Datum mit
  Uhrzeit. Ein reines Datum (`2026-01-05`) gilt als 12:00 Uhr in
  Europe/Berlin. Eine Uhrzeit ohne Zone (`2026-07-01 09:30` oder
  `2026-07-01T09:30`) gilt als Berliner Ortszeit. Mit `Z` oder Versatz
  (`+02:00`) gilt genau dieser Zeitpunkt. Alles andere ist ungültig und fällt
  auf das Änderungsdatum zurück.
* Umsetzung: Die Umrechnung der Berliner Ortszeit nutzt `Intl` in
  `packages/core/src/date.ts`, geprüft an den Umstellungstagen der
  Sommerzeit. Node 26 kennt `Temporal`, die TypeScript-Typen dafür wurden
  nicht geprüft.

# Slug

* **[E]** URL-Schema `/p/<slug>/`, siehe [URLs und SEO](/frontend/urls-seo.md).
* **[V]** Slugs werden transliteriert: ä→ae, ö→oe, ü→ue, ß→ss, danach
  Kleinbuchstaben, Ziffern und `-`.
* **[E]** Doppelte Slugs (O26): Es wird automatisch ein Suffix angehängt
  (`-2`, `-3`). Der Artikel mit dem älteren `date` behält den Slug, bei
  Gleichstand entscheidet der Pfad. Das ist deterministisch, aber nicht stabil:
  Kommt später ein Artikel mit älterem Datum und gleichem Slug hinzu, tauschen
  die URLs. Ein `slug:` im Frontmatter vermeidet das. Jede Vergabe eines
  Suffixes wird als Warnung geloggt.
* **[V]** Wird der Slug aus dem Dateinamen abgeleitet, ändert Umbenennen die
  URL. Ein `slug:` im Frontmatter fixiert sie.
* **[V]** Zerlegte Umlaute (a + ¨, wie sie macOS-Dateinamen liefern) werden vor
  dem Transliterieren zusammengesetzt (NFC).

# Tags

* **[E]** Tags existieren, auch für die Suche.
* **[V]** Gemeinsamer Tag-Namensraum für Posts und Memos.
* **[E]** Normalisierung (O13): Tags werden durchgehend kleingeschrieben, auch
  in der Anzeige (`iOS` wird `ios`). Ein führendes `#` entfällt, Leerraum wird
  zusammengefasst, doppelte Tags fallen weg. Die URL-Form ist transliteriert
  (`über größe` wird `/tag/ueber-groesse/`). Ein einzelner Text statt einer
  Liste zählt als ein Tag. Nicht-Text-Einträge werden mit Warnung ignoriert.
* Offen bleiben verschachtelte Memos-Tags (`#a/b`) und die Frage, ob Inline-
  `#tags` im Artikeltext zählen (W04 bzw. später).

# Fehlerbehandlung

* **[V]** Ungültiges YAML in einer Datei: nur diese Datei wird übersprungen und
  geloggt, nie der ganze Build.
* **[V]** `publish: true` mit ungültigem `date`: Fallback auf das
  Änderungsdatum und Warnung im Log.
* **[V]** Ungültiges YAML wird nur gemeldet, wenn die Datei erkennbar
  `publish: true` enthält. Sonst bleibt sie still ignoriert, damit private
  Notizen im Ordner keine Warnungen erzeugen.
* **[V]** Dateien mit Wikilinks (`[[...]]`, auch `![[...]]`) werden übersprungen
  und gemeldet. Code-Blöcke und Inline-Code zählen nicht.
* **[E]** Zurückgezogene Artikel (O21) (`publish` entfernt oder Datei gelöscht)
  verschwinden mit dem nächsten Build und liefern 404. Es gibt dafür keinen
  gespeicherten Zustand.
* **[U]** Die Muster für Konfliktkopien (`(conflicted copy ...)`,
  `(Konfliktkopie ...)`, `.sync-conflict-`) sind nicht gegen echte
  Nextcloud-Dateinamen geprüft. Das übernimmt der Contract-Test in W02.
