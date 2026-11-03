---
type: Architecture
title: Systemarchitektur
description: Komponenten, Datenflüsse und Grundregeln des statischen Blogs.
tags: [architektur, build, astro]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Komponenten

| Komponente | Rolle | Läuft |
|---|---|---|
| Nextcloud (extern) | Quelle der Artikel per Public-Share-WebDAV | extern |
| Memos (extern) | Quelle der Microposts, Public-API | extern |
| webmention.io (extern) | Empfang eingehender Webmentions | extern |
| Builder | Sync, Astro-Build, Pagefind, Scheduler, Mention-Sync und -Versand | Docker |
| Web | Auslieferung der statischen Dateien, Reverse-Proxy | Docker |
| Remark42 | Kommentare, E-Mail-Login | Docker |
| Migadu (extern) | SMTP für Login-Mails von Remark42 | extern |

# Datenfluss

1. **[E]** Der Builder prüft alle 3 Minuten Nextcloud, Memos, webmention.io und
   Remark42 auf Änderungen.
2. **[E]** Gibt es Änderungen, baut Astro die komplette Seite neu. Astro baut
   nicht inkrementell.
3. **[E]** Pagefind indexiert das Ergebnis. Das Ergebnis ersetzt atomar die
   bisher ausgelieferte Version (siehe [Pipeline](/ops/pipeline.md)).
4. **[E]** Der Browser fragt `build.json` ab (siehe
   [Live-Update](/frontend/live-update.md)).
5. **[E]** Kommentare werden im Browser über das Remark42-Widget geladen und
   gesendet. Zusätzlich liegt eine statische Kopie im HTML (SEO, ohne JS).

# Grundregeln

* **[V]** Static-first: Jede Seite funktioniert ohne Fremddienste, ohne
  Nextcloud und ohne Memos, sobald sie ausgeliefert ist. Nur Kommentieren
  braucht Remark42. Das ist meine Auslegung von "standalone", unbestätigt
  (O27).
* **[E]** Der Browser lädt zur Laufzeit nichts von Drittdiensten. Das Remark42-
  Widget wird vom eigenen Server geladen. Ausnahme sind Artikel: Sie dürfen
  Remote-Bilder und Einbettungen aus Freigabelisten enthalten, Einbettungen
  erst nach Klick (siehe [Medien](/content/media.md)).
* **[V]** Schlägt ein Abruf beim Build fehl, wird der Build abgebrochen und die
  letzte gute Version bleibt online. Ein leerer Abruf darf nie als "alles
  gelöscht" gelten.
* **[V]** Endpunkte, die Fremddaten holen (Mentions, Avatare, Memo-Bilder), sind
  durch [Bereinigung](/security/sanitization.md) abgesichert.

# Offen

Siehe [Offene Punkte](/open-points.md), insbesondere O1 (Block-Reihen), O9 (Reverse-Proxy) und O10 (Image-Build).
