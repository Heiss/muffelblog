---
type: Feature
title: Themes
description: Switchable color schemes in the style of well-known editor themes, implemented as CSS with variables.
tags: [themes, design, css, dark-mode]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T18:00:00Z }
---

# Occasion

The first preview (see [Feed](/frontend/feed.md)) was liked for its structure,
but looked too uniform ("too much alike"). The user therefore wants several
themes in the style of popular editor themes, also a Matrix green. The
structure stays unchanged, only the CSS files differ.

# Decisions

* **[E]** There are several themes that differ only in CSS.
* **[E]** They follow well-known editor themes (for example Dracula) and
  include a Matrix style in green.
* **[E]** All ten themes of the preview stay on offer, so every visitor can use
  what they like: Hell (the former look), Dracula, Matrix, Solarized Dark,
  Solarized Light, Nord, Gruvbox, Monokai, Tokyo Night, Catppuccin Mocha.
* **[E]** The default theme is Solarized Light. With a dark system setting and
  no stored choice, Solarized Dark applies. A stored choice wins.
* **[E]** Switcher: a select field (`select`) in the header, visible only with
  JavaScript.
* **[E]** Fonts per theme are self-hosted (Source Sans 3, Source Serif 4,
  JetBrains Mono, IBM Plex Mono from the packages `@fontsource/*`, OFL-1.1,
  `latin` only). No Google Fonts.
* **[E]** Code blocks are colored at build time with `lowlight`. The colors come
  as variables `--tok-*` from the theme.

# Implementation (W06c)

* **[V]** One block of CSS variables per theme under `[data-theme="<name>"]`,
  in the real structure one CSS file. Variables: `--bg`, `--panel`, `--line`,
  `--fg`, `--dim`, `--ac`, `--on-ac`, `--tint`, `--radius`, `--pill`,
  `--font-body`, `--font-head`, `--font-meta`.
* **[V]** The themes differ not only in colors but also in corner rounding and
  fonts. The IDE themes set headings and meta lines in a monospace font,
  Matrix is entirely monospace with square corners and a slight glow on titles.
* **[E]** The choice is kept in the browser (`localStorage`, key `muffel:theme`,
  optional).
* **[E]** So the wrong theme does not flash briefly while loading,
  `/theme-init.js` sets the attribute `data-theme` before the first paint.
  Because of `script-src 'self'` it is a file of its own and is loaded blocking
  from the `<head>`, not inline. It is generated from the same list as the
  switcher.
* **[E]** All fonts come from the own domain. The preview loaded them from
  Google, the site does not.

# Contrast

* **[E]** Every theme reaches at least 4.5:1 for text on background, panel and
  tint, muted text, accent, text on accent and the six code colors on the
  panel. `lib/themes.test.ts` checks this against `themes.css`.
* In the preview three palettes had to be adjusted: Solarized Light (darker
  muted text and accent), Nord (tint of the panels) and Monokai (accent lime
  green instead of pink).

# Open points

None. O35 is decided. Side note: border lines (`--line`) are not checked for
contrast, only text.
