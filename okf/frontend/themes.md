---
type: Feature
title: Themes
description: Umschaltbare Farbschemata im Stil bekannter Editor-Themes, umgesetzt als CSS-Dateien mit Variablen.
tags: [themes, design, css, dark-mode]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T18:00:00Z }
---

# Anlass

Die erste Vorschau (siehe [Feed](/frontend/feed.md)) gefiel im Aufbau, wirkte
aber zu einheitlich ("zu gleich wie alles"). Der Nutzer will deshalb mehrere
Themes im Stil beliebter Editor-Themes, auch mit Matrix-Grün. Der Aufbau bleibt
unverändert, nur die CSS-Dateien unterscheiden sich.

# Entscheidungen

* **[E]** Es gibt mehrere Themes, die sich nur im CSS unterscheiden.
* **[E]** Sie orientieren sich an bekannten Editor-Themes (zum Beispiel
  Dracula) und enthalten einen Matrix-Stil in Grün.
* **[E]** Alle zehn Themes der Vorschau bleiben im Angebot, damit jeder
  Besucher das nutzen kann, was er will: Hell (bisheriges Aussehen), Dracula,
  Matrix, Solarized Dark, Solarized Light, Nord, Gruvbox, Monokai, Tokyo
  Night, Catppuccin Mocha.
* **[E]** Das Standard-Theme ist Solarized Light.

# Vorschlag (aus der Vorschau, noch nicht bestätigt)
* **[V]** Umsetzung: Pro Theme ein Block mit CSS-Variablen unter
  `[data-theme="<name>"]`, im echten Aufbau je eine CSS-Datei. Variablen:
  `--bg`, `--panel`, `--line`, `--fg`, `--dim`, `--ac`, `--on-ac`, `--tint`,
  `--radius`, `--pill`, `--font-body`, `--font-head`, `--font-meta`.
* **[V]** Die Themes unterscheiden sich nicht nur in Farben, sondern auch in
  Ecken-Rundung und Schriften. Die IDE-Themes setzen Überschriften und
  Metazeilen in einer Monospace-Schrift, Matrix ist komplett Monospace mit
  eckigen Kanten und leichtem Glühen auf Titeln.
* **[V]** Umschalter im Seitenkopf, die Wahl bleibt im Browser erhalten. Ohne
  gespeicherte Wahl gilt der Standard Solarized Light. Ob Besucher mit dunkler
  Systemeinstellung stattdessen Solarized Dark als Gegenstück bekommen, ist
  offen (O35).
* **[V]** Damit beim Laden nicht kurz das falsche Theme aufblitzt, setzt ein
  kleines Skript im `<head>` das Attribut `data-theme` vor dem ersten Zeichnen.
  Wegen `script-src 'self'` liegt es als eigene Datei vor und wird blockierend
  geladen, nicht inline.
* **[V]** Alle Schriften kommen von der eigenen Domain, keine Google Fonts. Die
  Vorschau lädt sie nur aus technischen Gründen von Google.

# Kontrast

* **[V]** Jedes Theme erreicht für Text auf Hintergrund und Fläche, gedämpften
  Text, Akzent und Text auf Akzent mindestens 4,5:1. Das prüft ein Test.
* In der Vorschau mussten drei Paletten angepasst werden: Solarized Light
  (dunklerer gedämpfter Text und Akzent), Nord (Tönung der Flächen) und
  Monokai (Akzent Limettengrün statt Pink).

# Offene Punkte

Syntaxfarben für Code-Blöcke je Theme, Verhalten bei `prefers-color-scheme`
(dunkle Systemeinstellung) und die Schriftdateien selbst hosten: O35.
