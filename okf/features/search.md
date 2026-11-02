---
type: Feature
title: Suche
description: Volltextsuche mit Pagefind über Posts und Memos mit Filtern.
tags: [suche, pagefind]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Entscheidungen

* **[E]** Pagefind.
* **[E]** Posts und Memos sind im Index, weil beide statische Seiten haben.

# Umsetzung

* **[V]** Pagefind läuft als CLI nach dem Astro-Build über das Ausgabe-
  verzeichnis. Das Ergebnis liegt im Release, wird also mit ihm atomar
  ausgetauscht.
* **[V]** Filter: Typ (Post oder Memo) und Tag über `data-pagefind-filter`.
* **[V]** Technische Blöcke (`/seite/N/`) sind mit `data-pagefind-ignore`
  ausgeschlossen, sonst erscheinen Einträge doppelt.
* **[V]** Kommentare und Mentions sind nicht im Index.
* **[U]** Pagefind bietet eine deutschsprachige Oberfläche. Das ist nicht
  geprüft.

# Hinweis

Pagefind läuft im Browser mit WebAssembly und lädt seine Dateien von der
eigenen Domain. Es gibt keine Fremdrequests.
