---
type: Process
title: Build-Pipeline
description: Scheduler, Änderungserkennung, atomarer Austausch und Fehlerregeln des Builders.
tags: [build, scheduler, betrieb]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Ablauf

1. **[E]** Alle 3 Minuten prüft der Scheduler Nextcloud, Memos, webmention.io
   und Remark42.
2. **[V]** Er vergleicht Hashes oder Änderungsstände mit dem letzten Lauf. Ohne
   Änderung gibt es keinen Build.
3. **[V]** Bei Änderung wartet er kurz (Debounce), damit halbfertig
   synchronisierte Dateien nicht gebaut werden, und baut dann die komplette
   Seite.
4. **[V]** Nach Astro läuft Pagefind über das Ergebnis, `build.json` wird als
   letztes geschrieben, der Symlink `current` wird atomar umgehängt.
5. **[V]** Nach der Auslieferung sendet der Builder Webmentions (siehe
   [Webmentions](/community/webmentions.md)) und postet neue Mentions in
   Remark42.
6. **[V]** Alte Releases werden nach einer Frist gelöscht, die letzten N bleiben.

# Fehlerregeln

* **[V]** Schlägt ein Abruf fehl (Nextcloud, Memos, webmention.io oder Remark42),
  bricht der Build ab, und die letzte gute Version bleibt online. Ein leerer
  oder unvollständiger Abruf gilt nie als "alles gelöscht".
* **[V]** Eine kaputte einzelne Datei (ungültiges YAML, Wikilinks, fehlendes
  Bild) überspringt nur diese Datei und wird geloggt (siehe
  [Frontmatter](/content/frontmatter.md)).
* **[V]** Ein fehlgeschlagener Build wird gemeldet. Der Kanal ist offen (O18).

# Rate und Last

* Memo-Menge: ca. 2 pro Monat, Build-Zeit spielt kaum eine Rolle.
* **[V]** Für Kommentare werden nicht alle Seiten bei jedem Lauf einzeln
  abgefragt, sondern nur die geänderten (zum Beispiel über die letzten
  Kommentare seit dem letzten Lauf). **[U]** `GET /api/v1/last/{limit}?site&since`
  existiert laut API-Doku. Die Eignung ist nicht geprüft.

# Offen

O18 (Alerting, Backup), O10 (Image-Build), O8 (Versionen).
