---
type: Schema
title: Frontmatter-Schema für Artikel
description: Pflichtfelder, Fallbacks und Verarbeitungsregeln des YAML-Frontmatters der Markdown-Artikel.
tags: [frontmatter, obsidian, tags, slug]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Felder

| Feld | Typ | Pflicht | Regel |
|---|---|---|---|
| `publish` | boolean | **[E]** ja | Nur der Boolean `true` zählt. `"true"` oder `yes` zählen nicht. Fehlt es, wird die Datei ignoriert. |
| `date` | Datum/Zeit | **[E]** ja, mit Fallback | Fehlt oder ist ungültig: Änderungsdatum der Datei. |
| `title` | Text | **[V]** ja | Fehlt es, wird es aus dem Dateinamen abgeleitet. |
| `slug` | Text | **[V]** nein | Fehlt er, wird er aus dem Dateinamen abgeleitet. |
| `description` | Text | **[V]** nein | Meta-Description, Feed-Auszug. |
| `tags` | Liste | **[V]** nein | Obsidian-Properties, Listen von Strings. Dass es Tags gibt, ist **[E]**. |

Unbekannte Felder (`aliases`, `cssclasses` und weitere) werden ignoriert.

# Datum

* **[E]** `date` ist Pflichtfeld. Fehlt es, gilt das Änderungsdatum der Datei
  als Fallback.
* **[U]** Per WebDAV ist nur `getlastmodified` verfügbar, kein
  Erstellungsdatum. Das Änderungsdatum wird bei jeder Bearbeitung neu gesetzt.
  Posts ohne `date` springen dadurch in der Chronologie und erscheinen im RSS
  erneut als neu, wenn die GUID am Datum hängt.
* **[V]** Die RSS-GUID hängt deshalb nicht am Datum (siehe
  [RSS](/features/rss.md)).
* Format und Zeitzone sind offen, siehe O2 in [Offene Punkte](/open-points.md).

# Slug

* **[E]** URL-Schema `/p/<slug>/`, siehe [URLs und SEO](/frontend/urls-seo.md).
* **[V]** Slugs werden transliteriert: ä→ae, ö→oe, ü→ue, ß→ss, danach
  Kleinbuchstaben, Ziffern und `-`.
* **[V]** Doppelte Slugs lassen den Build für beide Dateien mit einer
  Fehlermeldung scheitern oder überspringen sie. Welches Verhalten gilt, ist
  offen (O26).
* **[V]** Wird der Slug aus dem Dateinamen abgeleitet, ändert Umbenennen die
  URL. Ein `slug:` im Frontmatter fixiert sie.

# Tags

* **[E]** Tags existieren, auch für die Suche.
* **[V]** Gemeinsamer Tag-Namensraum für Posts und Memos. Regeln zur
  Normalisierung (Groß-/Kleinschreibung, Umlaute, verschachtelte Memos-Tags
  wie `#a/b`) sind offen (O13).

# Fehlerbehandlung

* **[V]** Ungültiges YAML in einer Datei: nur diese Datei wird übersprungen und
  geloggt, nie der ganze Build.
* **[V]** `publish: true` mit ungültigem `date`: Fallback auf das
  Änderungsdatum und Warnung im Log.
