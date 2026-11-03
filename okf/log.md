# Update Log

## 2026-11-03
* **Creation**: [Glossar und Wissensgraph](/features/glossary.md) angelegt (Vorbild newworkglossar.de, Startseite ausgewertet); Arbeitspakete W19 bis W21, offener Punkt O38.
* **Update**: Split-View gestrichen (W06b entfällt), Unified mit Filter bleibt, Nicht-Ziel "kein Graph" ersetzt, siehe [Feed](/frontend/feed.md).
* **Update**: W06 in drei Pull Requests geteilt (W06a Endless Scroll, Filter, Rücksprung; W06b Split-View; W06c Themes); Entscheidungen zu Split-Daten, Moduswechsel und dunkler Systemeinstellung eingetragen.
* **Update**: Arbeitspaket W18 (Codequalität, Komplexität, Mutationstests ab 80 %) und O37 aufgenommen, bewusst nicht am Anfang.
* **Creation**: [Konfiguration](/ops/config.md) angelegt: Zahlenwerte für Feed und Memos als Umgebungsvariablen `MUFFEL_<BEREICH>_<NAME>`, ungültige Werte brechen den Build ab.
* **Update**: W05 umgesetzt (Branch `feature/w05-feed-statisch`): gemeinsamer Feed mit Blöcken zu 20, Reihen `/`, `/memos/`, `/posts/`, Tag-Übersicht und Tag-Listen, Sitemap und Canonical nur mit `SITE_URL`; Entscheidungen zu O1, O13, O20 eingetragen, siehe [Feed](/frontend/feed.md).
* **Update**: Merge-Regel festgehalten: eigene Pull Requests mergt Claude nach grüner CI selbst, siehe [Branching und Release](/ops/branching-release.md).

## 2026-11-02
* **Update**: W04 umgesetzt (Branch `feature/w04-memos`): Memos-Quelle, Seiten `/m/<uid>/`, Anhänge spiegeln, Contract-Test mit CI-Job; Entscheidungen O6, O14 und Tag-Regel eingetragen, siehe [Memos](/content/memos-source.md).
* **Update**: Themes: alle zehn bleiben, Standard ist Solarized Light (O35), siehe [Themes](/frontend/themes.md).
* **Update**: W03 umgesetzt (Branch `feature/w03-rendering`): Markdown-Rendering mit Bereinigung, Remote-Bilder und Einbettungen nur aus Freigabelisten, lokale Bilder als WebP ohne EXIF; Entscheidungen O5 und O7 eingetragen, siehe [Medien](/content/media.md).
* **Creation**: [Themes](/frontend/themes.md) angelegt: mehrere Farbschemata im Stil bekannter Editor-Themes (O35), Vorschau mit zehn Themes.
* **Update**: W01 umgesetzt (Branch `feature/w01-frontmatter`): Artikel-Loader, Frontmatter-Schema, Slugs, Datum, Tags, Seiten `/p/<slug>/`; Entscheidungen O2, O13 (teilweise), O21, O26 eingetragen, siehe [Frontmatter](/content/frontmatter.md).
* **Update**: Renovate läuft. Auto-Merge bleibt auf Patch beschränkt, TypeScript wird bei Version 6 gehalten (O31), siehe [Branching und Release](/ops/branching-release.md).
* **Update**: Erster CI-Lauf von W00 auf GitHub grün (Docker-Build, Lint/Typen/Unit/Build, E2E, Gate); Roadmap-Kriterien nachgezogen.
* **Update**: W00 umgesetzt (Branch `feature/w00-fundament`): Workspace, Astro-Gerüst, Vitest, Playwright, ESLint, Prettier, Dockerfile, CI mit Gate-Job, Renovate-Konfiguration; Befunde und offene Abnahmepunkte in der [Roadmap](/roadmap.md).
* **Update**: [Teststrategie](/ops/testing.md): Vitest und Playwright, volle Suite bei jedem PR und erneut beim Tag, gepinnte Testinstanzen, Gate-Job für Doku-PRs.
* **Creation**: [Teststrategie](/ops/testing.md) angelegt (TDD mit Mocks, E2E-Tests, Contract-Tests); Roadmap-Kriterien ergänzt.
* **Update**: Renovate (GitHub-App) mit Auto-Merge für Patch-Updates, 3 Tage Wartezeit, ohne Ausnahmen entschieden (O31); W00 um Renovate-Kriterien ergänzt.
* **Update**: Release-Tags von `vX.Y.Z` auf CalVer `YY.M.MICRO` ohne `v` umgestellt (SemVer-gültig), Auto-Updater-Regeln ergänzt, siehe [Branching und Release](/ops/branching-release.md).
* **Creation**: [Branching und Release](/ops/branching-release.md) angelegt: GitHub Flow, Squash-Merge, Tags `vX.Y.Z`, Images nur auf Tag.
* **Update**: Entscheidungen zu W00 eingetragen: Basis-Branch `main`, pnpm auf Node LTS, GitHub Actions, hybride Teststrategie.
* **Creation**: [Roadmap](/roadmap.md) mit Arbeitspaketen, Abhängigkeiten und Definition of Done angelegt.
* **Creation**: Bundle aus der Brainstorming-Sitzung angelegt, siehe [Überblick](/overview.md).
* **Review**: Kritische Durchsicht, Ergebnis in [Offene Punkte](/open-points.md).
