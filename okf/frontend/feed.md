---
type: Feature
title: Feed
description: Kombinierter, chronologischer Feed mit Split-View, Filter und Endless Scroll.
tags: [feed, split-view, endless-scroll, frontend]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Entscheidungen

* **[E]** Eine Startseite (`/`) zeigt Posts und Memos zusammen, rein
  chronologisch, neueste zuerst.
* **[E]** Endless Scroll statt sichtbarer Pagination.
* **[E]** Ab 1024px Breite gibt es eine Split-View: links Memos, rechts Posts,
  jeweils zeitlich sortiert. Der Balken in der Mitte ist verschiebbar, jede
  Seite lässt sich komplett ausblenden.
* **[E]** Zusätzlich gibt es den Unified-Modus (ein Strom) mit Filter
  (Alle / Posts / Memos).
* **[E]** Unter 1024px gibt es nur den Unified-Modus mit Filter.
* **[E]** Modus, Teilungsverhältnis, ausgeblendete Seite und Filter bleiben
  erhalten (Browser-Speicher).
* **[E]** Memos erscheinen vollständig mit Bildern.
* **[V]** Posts erscheinen im Feed mit Auszug (Länge offen, siehe O20).
* **[E]** Posts und Memos haben eigene Seiten, die der Feed verlinkt.

# Datenquelle für Endless Scroll

* **[E]** Technische HTML-Blöcke `/seite/N/` mit `noindex, follow`. Das
  JavaScript lädt sie beim Scrollen und hängt die Einträge an. Besucher sehen
  nie eine Pagination. Ohne JavaScript steht in `<noscript>` ein "Weiter"-Link.
* **[E]** Die Blöcke sind nicht in Pagefind (`data-pagefind-ignore`) und nicht
  in der Sitemap. `/seite/1/` verweist per Canonical auf `/`.
* **[E]** Tag-Listen nutzen dasselbe Verfahren.
* **[V]** Die Split-View braucht pro Spalte eine eigene chronologische Liste.
  Aus den gemischten Blöcken ließen sich die Spalten nur durch Filtern
  füllen, was ungleich lange Spalten erzeugt. Deshalb werden drei Block-
  Reihen erzeugt: gemischt (`/seite/N/`), nur Memos (`/memos/seite/N/`), nur
  Posts (`/posts/seite/N/`). Der Filter im Unified-Modus nutzt die
  passende Reihe. Blockgröße (Vorschlag: 20 Einträge) und Pfade sind in
  O1 erfasst.

# Verhalten im Browser

* **[V]** `IntersectionObserver` am Listenende lädt den nächsten Block.
  Doppelte Einträge werden anhand ihrer ID verworfen.
* **[V]** Scrollposition und geladene Blöcke werden bei Rücksprung vom
  Artikel wiederhergestellt (History-API).
* **[V]** Der Footer ist bei Endless Scroll schwer erreichbar. Wichtige Links
  (Impressum, Datenschutz, RSS) gehören deshalb in die feste Kopf- oder
  Seitenleiste.
* **[V]** Eine Spalte der Split-View kann den Fokus behalten, ohne dass die
  andere mitscrollt. Beide Spalten scrollen unabhängig.
* **[V]** Der Browser-Speicher (`localStorage`) ist optional. Fehlt er, gelten
  Standardwerte (Unified auf schmalen, Split auf breiten Schirmen,
  Verhältnis 50:50).

# Barrierefreiheit

**[V]** Der Balken zwischen den Spalten ist per Tastatur bedienbar
(`role="separator"`, Pfeiltasten). Neue Blöcke werden per `aria-live` nicht
einzeln angesagt.
