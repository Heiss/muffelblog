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
* **[E]** Das Standard-Theme ist Solarized Light. Bei dunkler Systemeinstellung
  ohne gespeicherte Wahl gilt Solarized Dark. Eine gespeicherte Wahl gewinnt.
* **[E]** Umschalter: Auswahlfeld (`select`) in der Kopfleiste, nur mit
  JavaScript sichtbar.
* **[E]** Schriften je Theme selbst gehostet (Source Sans 3, Source Serif 4,
  JetBrains Mono, IBM Plex Mono aus den Paketen `@fontsource/*`, OFL-1.1, nur
  `latin`). Keine Google Fonts.
* **[E]** Code-Blöcke werden beim Build mit `lowlight` gefärbt. Die Farben
  kommen als Variablen `--tok-*` aus dem Theme.

# Umsetzung (W06c)
* **[V]** Umsetzung: Pro Theme ein Block mit CSS-Variablen unter
  `[data-theme="<name>"]`, im echten Aufbau je eine CSS-Datei. Variablen:
  `--bg`, `--panel`, `--line`, `--fg`, `--dim`, `--ac`, `--on-ac`, `--tint`,
  `--radius`, `--pill`, `--font-body`, `--font-head`, `--font-meta`.
* **[V]** Die Themes unterscheiden sich nicht nur in Farben, sondern auch in
  Ecken-Rundung und Schriften. Die IDE-Themes setzen Überschriften und
  Metazeilen in einer Monospace-Schrift, Matrix ist komplett Monospace mit
  eckigen Kanten und leichtem Glühen auf Titeln.
* **[E]** Die Wahl bleibt im Browser erhalten (`localStorage`, Schlüssel
  `muffel:theme`, optional).
* **[E]** Damit beim Laden nicht kurz das falsche Theme aufblitzt, setzt
  `/theme-init.js` das Attribut `data-theme` vor dem ersten Zeichnen. Wegen
  `script-src 'self'` liegt es als eigene Datei vor und wird blockierend aus
  dem `<head>` geladen, nicht inline. Es wird aus derselben Liste wie der
  Umschalter erzeugt.
* **[E]** Alle Schriften kommen von der eigenen Domain. Die Vorschau lud sie
  von Google, die Seite nicht.

# Kontrast

* **[E]** Jedes Theme erreicht für Text auf Hintergrund, Fläche und Tönung,
  gedämpften Text, Akzent, Text auf Akzent und die sechs Code-Farben auf der
  Fläche mindestens 4,5:1. Das prüft `lib/themes.test.ts` gegen `themes.css`.
* In der Vorschau mussten drei Paletten angepasst werden: Solarized Light
  (dunklerer gedämpfter Text und Akzent), Nord (Tönung der Flächen) und
  Monokai (Akzent Limettengrün statt Pink).

# Offene Punkte

Keine. O35 ist entschieden. Randnotiz: Rahmenlinien (`--line`) sind nicht
auf Kontrast geprüft, nur Text.
