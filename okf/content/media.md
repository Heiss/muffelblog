---
type: Policy
title: Medien
description: Umgang mit Bildern und Fremdinhalten in Artikeln und Memos.
tags: [bilder, medien, datenschutz]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Entscheidungen

* **[E]** Memo-Bilder werden beim Build auf die eigene Domain gespiegelt.
* **[E]** Der Browser lädt nichts von anderen Diensten.

# Artikel-Bilder

* **[V]** Bilder in Artikeln liegen im Nextcloud-Ordner und sind per
  relativem Markdown-Pfad eingebunden (`![](pfad/bild.png)`, Leerzeichen als
  `%20`). Nur Bilder, die ein veröffentlichter Artikel referenziert, kommen in
  den Build.
* **[V]** Fehlt ein referenziertes Bild, wird der Artikel mit Warnung gebaut.

# Gespiegelte Bilder

* **[V]** Beim Spiegeln werden EXIF-Daten entfernt, insbesondere GPS.
  Handyfotos aus Memos tragen sonst Standortdaten.
* **[V]** Typprüfung: nur Rasterformate (JPEG, PNG, WebP, GIF, AVIF). SVG wird
  abgelehnt.
* **[V]** Größen- und Zeitlimit für jeden Abruf.
* **[V]** Abrufe von Fremd-URLs (Mention-Avatare) lehnen private und interne
  IP-Bereiche ab (siehe [Bereinigung](/security/sanitization.md)).

# Offene Fragen

Remote-Bilder und Einbettungen (iframes) in Markdown (O5), Anhänge, die keine
Bilder sind (O6), Bildgrößen und Formate (O7).
