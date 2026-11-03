---
type: Feature
title: Feed
description: Kombinierter, chronologischer Feed mit Filter und Endless Scroll.
tags: [feed, endless-scroll, frontend]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Entscheidungen

* **[E]** Eine Startseite (`/`) zeigt Posts und Memos zusammen, rein
  chronologisch, neueste zuerst.
* **[E]** Endless Scroll statt sichtbarer Pagination.
* **[E]** Der Feed ist ein einziger Strom (Unified-Modus) mit Filter
  (Alle / Lang / Kurz, später auch Begriffe). Der Filter bleibt im
  Browser-Speicher erhalten.
* **[E]** Die Split-View (zwei Spalten mit verschiebbarem Balken) entfällt. Der
  Nutzer hält sie für unnötige Komplexität. Die Entscheidung vom Anfang ist
  damit ersetzt.
* **[E]** Beschriftungen des Filters: **Kurz** für Memos, **Lang** für
  Blogbeiträge und **Begriffe** für Glossareinträge. Die Beschriftung gilt in
  der Anzeige, Überschriften und Seitentiteln. Die Adressen der Reihen bleiben
  `/memos/` und `/posts/` (und für Begriffe `/begriffe/`), die Einzelseiten
  `/m/<uid>/` und `/p/<slug>/`.
* **[E]** Memos erscheinen vollständig mit Bildern.

# Datenquelle für Endless Scroll

* **[E]** Technische HTML-Blöcke `/seite/N/` mit `noindex, follow`. Das
  JavaScript lädt sie beim Scrollen und hängt die Einträge an. Besucher sehen
  nie eine Pagination. Ohne JavaScript führt ein normaler "Ältere Einträge"-Link
  weiter (umgesetzt in W05).
* **[E]** Die Blöcke sind nicht in Pagefind (`data-pagefind-ignore`) und nicht
  in der Sitemap. Seite 1 hat keine eigene Route (`/seite/1/` gibt 404), sie
  liegt an der Basis (`/`, `/memos/`, `/posts/`, `/tag/<tag>/`).
* **[E]** Tag-Listen nutzen dasselbe Verfahren.
* **[E]** Der Filter nutzt je eine Block-Reihe: gemischt (`/seite/N/`), nur
  Memos (`/memos/seite/N/`), nur Posts (`/posts/seite/N/`). **[E]** Blockgröße
  20 Einträge. Umgesetzt in W05.

# Verhalten im Browser

* **[E]** `IntersectionObserver` am Listenende lädt den nächsten Block.
  Doppelte Einträge werden anhand ihrer ID verworfen (umgesetzt in W06a).
* **[E]** Scrollposition und geladene Blöcke werden bei Rücksprung vom
  Artikel wiederhergestellt (umgesetzt in W06a, Merkzettel im `sessionStorage`).
* **[V]** Der Footer ist bei Endless Scroll schwer erreichbar. Wichtige Links
  (Impressum, Datenschutz, RSS) gehören deshalb in die feste Kopf- oder
  Seitenleiste.
* **[E]** Der Browser-Speicher (`localStorage`) ist optional. Fehlt er, gilt der
  Standardfilter "Alle".

# Barrierefreiheit

**[V]** Neue Blöcke werden per `aria-live` nicht einzeln angesagt. Fehler beim
Nachladen stehen in einem Bereich mit `role="status"` samt normalem Link.
