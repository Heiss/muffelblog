---
type: Feature
title: RSS
description: Kombinierter RSS-Feed für Posts und Memos.
tags: [rss, feed]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Entscheidungen

* **[E]** Ein kombinierter Feed für Posts und Memos.

# Umsetzung

* **[V]** `/feed.xml`, erzeugt beim Build mit dem Astro-RSS-Paket.
* **[V]** Anzahl der Einträge begrenzt (Vorschlag: 50). Volltext oder Auszug
  ist offen (O20).
* **[V]** Die GUID ist der stabile Bezeichner `post:<slug>` bzw. `memo:<uid>`
  mit `isPermaLink="false"` und hängt nicht am Datum und nicht an der Domain.
  So bleiben GUIDs bei einem Domainwechsel oder einer Datumsänderung gleich.
* **[V]** Memos haben keinen Titel, der Feed-Titel wird aus dem Text abgeleitet
  (siehe [Memos](/content/memos-source.md)).
* **[V]** Kommentare und Mentions erscheinen nicht im Feed.

# Risiko

Ohne Domain (siehe [URLs und SEO](/frontend/urls-seo.md)) lassen sich keine
absoluten Links erzeugen. Feeds brauchen absolute URLs.
