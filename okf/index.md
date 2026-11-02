---
okf_version: "0.2"
---

# Überblick

* [Überblick und Ziele](/overview.md) - Zweck, Umfang, Legende der Kennzeichnungen (E/V/U)
* [Offene Punkte](/open-points.md) - Ergebnis der kritischen Durchsicht, priorisiert

# Planung

* [Roadmap](/roadmap.md) - Arbeitspakete W00 bis W17 mit Abhängigkeiten und Definition of Done

# Architektur

* [Systemarchitektur](/architecture/system.md) - Komponenten, Datenflüsse, Grundregeln
* [Docker-Betrieb](/architecture/docker.md) - Dienste, Volumes, Secrets, Release-Austausch

# Inhalt und Quellen

* [Nextcloud-Quelle](/content/nextcloud-source.md) - Public Share, Sync, Ausschlüsse
* [Frontmatter-Schema](/content/frontmatter.md) - Pflichtfelder, Fallbacks, Tags, Slug
* [Memos-Quelle](/content/memos-source.md) - Abruf zur Build-Zeit, Memo-Seiten
* [Medien](/content/media.md) - Bilder spiegeln, Fremdinhalte

# Frontend

* [Feed](/frontend/feed.md) - Kombinierter Feed, Split-View, Filter, Endless Scroll
* [Live-Update](/frontend/live-update.md) - build.json und Banner "N neue Einträge"
* [URLs und SEO](/frontend/urls-seo.md) - URL-Schema, Canonical, Sitemap

# Funktionen

* [Suche](/features/search.md) - Pagefind
* [RSS](/features/rss.md) - Kombinierter Feed

# Community

* [Kommentare](/community/comments.md) - Remark42 mit E-Mail-Login
* [Webmentions](/community/webmentions.md) - Empfangen, Senden, Anzeige als Remark42-Kommentare

# Sicherheit

* [Bereinigung fremder Inhalte](/security/sanitization.md) - Sanitizing, SSRF-Schutz, Secrets

# Betrieb

* [Build-Pipeline](/ops/pipeline.md) - Scheduler, Änderungserkennung, atomarer Austausch, Fehlerregeln
* [Teststrategie](/ops/testing.md) - TDD mit Mocks, E2E-Tests, Contract-Tests vor jedem Tag
* [Branching und Release](/ops/branching-release.md) - GitHub Flow, Squash-Merge, CalVer-Tags YY.M.MICRO, Auto-Updater
