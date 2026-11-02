---
type: Data Source
title: Memos-Quelle
description: Abruf öffentlicher Memos zur Build-Zeit und Erzeugung eigener Memo-Seiten.
tags: [memos, build, microblog]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
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

# Abruf

* **[U]** Die Memos-API liefert öffentliche Memos ohne Authentifizierung. Das
  ist nicht belegt, Memos-API und Filter sind versionsabhängig.
* **[U]** Anhänge öffentlicher Memos sind ohne Token abrufbar. Nicht geprüft.
* **[V]** Der Builder implementiert den Abruf als eigenen Content-Loader in
  Astro. Die API-Version wird im Loader dokumentiert und gegen eine
  Beispielantwort getestet, damit ein Memos-Update den Bruch sichtbar macht.
* **[V]** Änderungserkennung durch Hash der abgerufenen Daten. Kein Webhook,
  Polling alle 3 Minuten reicht bei 2 Memos pro Monat.

# Abgeleitete Felder

* **[V]** Memos haben keinen Titel. Die Seite bekommt als Titel den
  Textanfang, als Description die ersten Sätze, als Fallback Datum und Uhrzeit.
* **[V]** Inline-Tags (`#tag`) des Memos werden zu Tags.
* **[V]** Der Memos-Markdown läuft durch dieselbe Render- und
  Bereinigungs-Kette wie die Artikel (siehe
  [Bereinigung](/security/sanitization.md)).
* Ob `createTime` oder `displayTime` als Datum gilt, ist offen (O14).

# Löschen und Zurückstufen

Ein Memo, das nicht mehr öffentlich oder gelöscht ist, fehlt im nächsten Build.
Besuchern mit offenen Tabs, Browser-Caches und Suchmaschinen bleiben Kopien.
Bricht der Abruf ab, darf das Memo nicht als gelöscht gelten (siehe
[Pipeline](/ops/pipeline.md)).
