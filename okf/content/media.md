---
type: Policy
title: Medien
description: Umgang mit Bildern und Fremdinhalten in Artikeln und Memos.
tags: [bilder, medien, datenschutz, einbettungen]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Entscheidungen

* **[E]** Memo-Bilder werden beim Build auf die eigene Domain gespiegelt.
* **[E]** Artikel dürfen Fremdinhalte laden, aber nur aus Freigabelisten
  (O5). Das weicht von der Regel "der Browser lädt nichts von Drittdiensten"
  ab und gilt nur für Artikel, nicht für Memos.
  * Remote-Bilder (nur https): `upload.wikimedia.org`,
    `raw.githubusercontent.com`, `user-images.githubusercontent.com`.
  * Einbettungen: `www.youtube-nocookie.com`, Pfad `/embed/<11 Zeichen>`.
    Sie starten erst nach einem Klick, vorher geht keine Anfrage an YouTube.
* **[E]** Lokale Artikelbilder (O7): verkleinern, als WebP ausliefern, EXIF
  entfernen.

Die Listen stehen im Code (`packages/core/src/policy.ts`) und speisen später
die Content-Security-Policy. Eine neue Domain ist eine Codeänderung mit Test.

# Lokale Artikelbilder

* Bilder liegen im Nextcloud-Ordner und sind per relativem Markdown-Pfad
  eingebunden (`![](pfad/bild.png)`, Leerzeichen als `%20`).
* **[V]** Der Pfad gilt relativ zur Notiz. Wird die Datei dort nicht gefunden
  und beginnt der Pfad nicht mit `./` oder `../`, gilt er danach ab der
  Ordnerwurzel (so schreibt Obsidian bei absoluten Vault-Pfaden).
* Erlaubt sind PNG, JPEG, WebP, GIF und AVIF bis 25 MB. SVG wird abgelehnt.
* Ausgabe: WebP in den Breiten 480, 960, 1440 und 1920 (soweit das Original
  breit genug ist, nie vergrößert), `srcset`, Breite und Höhe, `loading="lazy"`.
  Ein Bild unter 480 px Breite wird in Originalbreite ausgeliefert.
* Die EXIF-Ausrichtung wird angewandt, danach entfallen alle Metadaten
  (GPS, Kamera, Farbprofil). Animierte GIFs bleiben animiert.
* Dateinamen der Varianten bestehen aus einer Kennung des Inhalts
  (`<16 Hex-Zeichen>-<Breite>.webp`) unter `/media/`. Dasselbe Bild wird nur
  einmal verarbeitet.
* Abgewiesen werden: Pfade außerhalb des Inhaltsordners (`../`, absolute
  Pfade), versteckte Ordner (`.obsidian/`), Verweise (Symlinks) aus dem Ordner
  heraus, Pfade mit `?` oder `#`.
* Nur Bilder, die ein veröffentlichter Artikel verwendet, gelangen in den Build.
* Ein fehlendes oder unbrauchbares Bild lässt den Build nicht scheitern. Es
  erscheint ein Platzhalter mit Alt-Text, und das Log warnt.

# Remote-Bilder

* Bilder freigegebener Hosts bleiben als Adresse stehen, mit `loading="lazy"`,
  `decoding="async"` und `referrerpolicy="no-referrer"`. Sie werden nicht
  gespiegelt.
* Bilder anderer Hosts, mit `http`, mit Zugangsdaten oder fremdem Port, `data:`-
  Adressen und protokoll-relative Adressen werden entfernt. Das Log warnt, der
  Alt-Text bleibt als Text.
* Risiko: Jeder Aufruf eines Remote-Bildes verrät die IP-Adresse des
  Besuchers an den Host. Das ist ein Datenschutzthema (O15).

# Einbettungen

* Ein `<iframe>` im Markdown wird nur übernommen, wenn seine Adresse genau zu
  einer Regel passt (https, genauer Host, genauer Pfad, keine Parameter, keine
  Zugangsdaten). Alle Attribute des Autors entfallen.
* Stattdessen steht ein Platzhalter mit Hinweis, Knopf "Inhalt laden" und einem
  Link zur Ursprungsseite. Ohne JavaScript bleibt der Link.
* Nach dem Klick setzt ein kleines Skript ein `iframe` mit
  `sandbox="allow-scripts allow-same-origin allow-presentation"`,
  `referrerpolicy="no-referrer"` und `loading="lazy"` ein. Es prüft die Adresse
  noch einmal gegen dieselbe Richtlinie.
* Alle anderen Einbettungen werden entfernt und im Log gemeldet.

# Memo-Bilder

* **[E]** Werden auf die eigene Domain gespiegelt, nichts wird von der
  Memos-Instanz geladen (siehe [Memos](/content/memos-source.md), W04).
* **[V]** Beim Spiegeln werden EXIF-Daten entfernt, insbesondere GPS.
  Handyfotos aus Memos tragen sonst Standortdaten. Dieselbe Verarbeitung
  (`processImage`) wie bei Artikelbildern.
* **[V]** Größen- und Zeitlimit für jeden Abruf. Abrufe von Fremd-URLs
  (Mention-Avatare) lehnen private und interne IP-Bereiche ab (siehe
  [Bereinigung](/security/sanitization.md)).

# Offene Fragen

Anhänge, die keine Bilder sind (O6).
