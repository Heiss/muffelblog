---
type: Specification
title: Muffelblog - Überblick und Ziele
description: Zweck, Umfang und Legende der Spezifikation für den statischen Blog mit Memos-Microblog.
tags: [blog, astro, memos, nextcloud, docker]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Zweck

Ein flacher, persönlicher Blog. Artikel entstehen als Markdown in einem
Nextcloud-Ordner (bearbeitet mit Obsidian). Kurznachrichten kommen aus einer
Memos-Instanz. Beides erscheint in einem kombinierten, zeitlich sortierten
Feed. Die Seite wird statisch erzeugt und per Docker ausgeliefert.

# Legende der Kennzeichnungen

Diese Spezifikation trennt Bestätigtes von Vorschlägen:

* **[E]** Entscheidung: vom Nutzer ausdrücklich bestätigt.
* **[V]** Vorschlag: vom Assistenten ergänzt, nicht bestätigt.
* **[U]** Ungeprüft: Tatsachenbehauptung über Software, die nicht belegt ist
  und vor der Umsetzung geprüft werden muss.

# Festgelegte Eckpunkte

* **[E]** Generator: Astro, statisch. Client-Code in Vanilla-TS ohne Framework.
* **[E]** Quelle der Artikel: Nextcloud-Public-Share (mit Passwort), Root-Ordner,
  Zugriff per WebDAV. Nextcloud ist die einzige Quelle, kein Git-Inhalt.
* **[E]** Veröffentlicht wird nur, was `publish: true` trägt.
* **[E]** Memos (Public) werden zur Build-Zeit geholt und bekommen eigene Seiten.
* **[E]** Kombinierter Feed, rein chronologisch, Endless Scroll, Split-View
  ab 1024px, mobil nur Unified mit Filter.
* **[E]** Auto-Update über `build.json`, Banner "N neue Einträge".
* **[E]** Suche mit Pagefind, Tags, kombinierter RSS-Feed.
* **[E]** Kommentare: Remark42 mit E-Mail-Login, für Posts und Memos.
* **[E]** Webmentions: webmention.io, empfangen und senden, Anzeige als
  Kommentare in Remark42.
* **[E]** Sprache Deutsch. Domain wird später festgelegt.
* **[E]** Betrieb komplett in Docker.

# Nicht-Ziele

* Keine Wikilinks, kein Digital-Garden-Graph.
* Keine Kommentare auf der Memos-Instanz selbst.
* Keine Laufzeit-Requests des Browsers an Drittdienste. Ausnahme: Artikel mit
  Remote-Bildern und Einbettungen aus Freigabelisten (siehe
  [Medien](/content/media.md)).

# Gliederung

* Architektur: [System](/architecture/system.md), [Docker](/architecture/docker.md)
* Inhalt: [Nextcloud](/content/nextcloud-source.md),
  [Frontmatter](/content/frontmatter.md), [Memos](/content/memos-source.md),
  [Medien](/content/media.md)
* Frontend: [Feed](/frontend/feed.md), [Live-Update](/frontend/live-update.md),
  [URLs und SEO](/frontend/urls-seo.md)
* Funktionen: [Suche](/features/search.md), [RSS](/features/rss.md)
* Community: [Kommentare](/community/comments.md),
  [Webmentions](/community/webmentions.md)
* [Bereinigung](/security/sanitization.md), [Pipeline](/ops/pipeline.md)
* [Offene Punkte](/open-points.md)
