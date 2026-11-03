---
type: Reference
title: URLs und SEO
description: URL-Schema, Canonical-Regeln, Sitemap und SEO-Grundsätze.
tags: [url, seo, sitemap, canonical]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# URL-Schema

| Seite | URL | Stand |
|---|---|---|
| Feed (Start) | `/` | **[E]** |
| Post | `/p/<slug>/` | **[E]** |
| Memo | `/m/<uid>/` | **[E]** |
| Technische Blöcke (gemischt) | `/seite/N/` | **[E]** |
| Technische Blöcke (Memos, Posts) | `/memos/seite/N/`, `/posts/seite/N/` | **[E]** |
| Tag-Übersicht | `/tag/` | **[E]** |
| Tag | `/tag/<tag>/`, Blöcke `/tag/<tag>/seite/N/` | **[E]** |
| Suche | `/suche/` | **[V]** |
| RSS | `/feed.xml` | **[V]** |
| Build-Signal | `/build.json` | **[E]** |

Die Namen Tag, Suche und RSS-Pfad sind Vorschläge zur kurzen und prägnanten
Form, die der Nutzer gewünscht hat. Der Nutzer hat `/p/<slug>/` und
`/m/<uid>/` bestätigt.

# SEO-Regeln

* **[E]** Jeder Post und jedes Memo hat eine eigene Seite zum Verlinken und
  für Suchmaschinen.
* **[V]** Der Slug trägt Schlüsselwörter und enthält kein Datum.
* **[V]** Eine kanonische URL pro Seite, einheitlicher Slash am Ende.
* **[E]** `lang="de"`, absolute Canonical-URLs und Sitemap mit Startseite,
  Posts, Memos und Tags, aber ohne `/seite/N/`. Beides entsteht nur, wenn
  `SITE_URL` gesetzt ist (Domain offen, O9).
* **[V]** Memos haben keinen Titel. Titel und Description werden aus dem Text
  abgeleitet (siehe [Memos](/content/memos-source.md)).

# Domain

**[E]** Die Domain wird später festgelegt. Webmention-Ziele, Remark42-
Zuordnung und RSS-Identifikatoren hängen an der URL und sollten vor dem ersten
Kommentar und der ersten Mention feststehen. Für Remark42 beschreibt die
API-Doku `POST /api/v1/admin/remap` zum Umziehen von Kommentaren. Webmentions
an der alten Domain gehen verloren.

# Offen

Open Graph und Social Cards (O17), 404-Seite, `robots.txt`, Favicon (O16),
Impressum und Datenschutz als eigene Seiten (O15).
