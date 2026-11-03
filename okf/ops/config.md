---
type: Policy
title: Konfiguration per Umgebungsvariable
description: Welche Zahlenwerte per Umgebungsvariable einstellbar sind, ihre Standardwerte, Spannen und das Fehlerverhalten.
tags: [konfiguration, umgebungsvariablen, betrieb]
status: draft
generated: { by: claude-code/web, at: 2026-11-03T05:30:00Z }
---

# Entscheidungen

* **[E]** Zahlenwerte, die der Betreiber ändern können soll, sind
  Umgebungsvariablen nach dem Schema `MUFFEL_<BEREICH>_<NAME>`. Die bestehenden
  Namen `CONTENT_DIR`, `MEMOS_URL` und `SITE_URL` bleiben unverändert.
* **[E]** Ein ungültiger Wert bricht den Build ab, die letzte gute Version bleibt
  online. Es gibt keine Warnung mit Rückfall auf den Standardwert.
* **[E]** Umfang: Feed und Memos. Medien (Bildbreiten, Dateigrenze für Bilder)
  bleiben vorerst im Code.
* **[E]** Freigabelisten für Hosts und Dateitypen sowie die Prüfung der
  Dateikennung sind nicht konfigurierbar. Eine Fehlkonfiguration soll keine
  Sicherheitslücke öffnen.

# Regeln

* Alle Werte gelten beim Build und sind in die Seiten geschrieben. Eine
  Änderung wirkt erst nach dem nächsten Build.
* Erlaubt sind nur Ganzzahlen ohne Vorzeichen, Leerraum außen wird entfernt.
  Eine leere Variable gilt als nicht gesetzt (Compose liefert sie so).
* Alle Fehler werden auf einmal gemeldet, mit Variablenname und Spanne.
* Quelle der Wahrheit ist `packages/core/src/config.ts` (`SETTING_SPECS`). Die
  Tabelle unten muss dazu passen, ein Test prüft Standardwerte und Grenzen.

# Variablen

| Variable | Standard | Spanne | Wirkung |
|---|---|---|---|
| `MUFFEL_FEED_PAGE_SIZE` | 20 | 1 bis 200 | Einträge pro Block des Feeds |
| `MUFFEL_FEED_EXCERPT_CHARS` | 200 | 20 bis 2000 | Länge des Artikelauszugs im Feed |
| `MUFFEL_MEMOS_DESCRIPTION_CHARS` | 160 | 20 bis 500 | Länge der Beschreibung einer Memo-Seite |
| `MUFFEL_MEMOS_TIMEOUT_MS` | 30000 | 1000 bis 300000 | Zeitlimit je Anfrage an Memos |
| `MUFFEL_MEMOS_MAX_FILE_MB` | 25 | 1 bis 500 | Höchstgröße je gespiegelter Memo-Datei |

Weitere Variablen: `CONTENT_DIR`, `MEMOS_URL` (Pflicht), `SITE_URL`
(optional, Sitemap und Canonical), `MUFFEL_FIXTURES=1` (nur Entwicklung und
Tests). Der Test-Build im Repo setzt `MUFFEL_FEED_PAGE_SIZE=4`.

# Offen

* **[U]** Bildbreiten und Größenlimit für Bilder (`media.ts`), Polling-
  Intervall und Zeitlimits späterer Pakete sind nicht umgestellt. Neue
  Zahlenwerte sollen mit ihrem Arbeitspaket eine Variable bekommen.
* **[U]** Ob die Docker-Dienste die Variablen durchreichen, steht erst mit
  W11/W12 fest.
