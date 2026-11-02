---
type: Data Source
title: Nextcloud-Quelle
description: Public Share eines Nextcloud-Ordners als alleinige Quelle der Artikel.
tags: [nextcloud, webdav, sync, obsidian]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Entscheidungen

* **[E]** Der Ordner wird als Public Share bereitgestellt, mit Passwort.
* **[E]** Der Builder verwendet den Root des Shares, der Ordnername ist egal.
* **[E]** Nextcloud ist die einzige Quelle. Bearbeitet wird mit Obsidian (auch
  mobil), im Notfall mit Nextcloud Notes.
* **[E]** Nur Dateien mit `publish: true` werden berücksichtigt (siehe
  [Frontmatter](/content/frontmatter.md)).
* **[E]** Ändert sich die Nextcloud-Version oder Memos-Version, soll jeweils die
  neueste laufen.

# Zugriff

* **[V]** Sync per `rclone` (WebDAV) in den `cache`-Bereich, Polling alle 3
  Minuten.
* **[U]** Public Shares sind per WebDAV unter `/public.php/webdav/` erreichbar.
  Der Benutzername ist der Share-Token, das Passwort das Share-Passwort. Das
  muss vor der Umsetzung gegen die Nextcloud-Version geprüft werden.
* **[V]** Änderungserkennung über Dateiliste mit Größe und Änderungsdatum bzw.
  ETag, damit nur bei echter Änderung gebaut wird.

# Risiken

* Der Share-Link macht den gesamten Ordner abrufbar, auch Entwürfe,
  `.obsidian/` und Dateien ohne `publish: true`. Das Passwort ist die einzige
  Schutzschicht. Das Passwort ist daher Pflicht und ein Secret (siehe
  [Docker](/architecture/docker.md)).
* Obsidian-Mobil synchronisiert halbfertige Dateien. Gegenmaßnahmen: Opt-in per
  `publish`, Debounce im Scheduler (siehe [Pipeline](/ops/pipeline.md)).
* Nextcloud legt bei Konflikten Kopien an.

# Ausschlüsse

**[V]** Beim Einlesen werden ignoriert:

* Ordner und Dateien, die mit `.` beginnen (`.obsidian/`, `.trash/`)
* Konfliktkopien (Muster `*(conflicted copy)*` und die von Nextcloud
  verwendeten Varianten)
* Dateien ohne `.md`-Endung (außer referenzierten Medien, siehe
  [Medien](/content/media.md))
* Dateien ohne `publish: true`

# Obsidian-Einstellungen

* **[E]** Keine Wikilinks.
* **[V]** In Obsidian muss "Use Wikilinks" aus sein, sonst entstehen Bild-
  Einbettungen als `![[bild.png]]`, die der Build nicht auflöst. Der Build soll
  Wikilink-Syntax erkennen und den Build mit einer Warnung für diese Datei
  überspringen, statt kaputtes HTML zu erzeugen.
