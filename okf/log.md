# Update Log

## 2026-11-02
* **Update**: W03 umgesetzt (Branch `feature/w03-rendering`): Markdown-Rendering mit Bereinigung, Remote-Bilder und Einbettungen nur aus Freigabelisten, lokale Bilder als WebP ohne EXIF; Entscheidungen O5 und O7 eingetragen, siehe [Medien](/content/media.md).
* **Creation**: [Themes](/frontend/themes.md) angelegt: mehrere Farbschemata im Stil bekannter Editor-Themes (O35), Vorschau mit zehn Themes.
* **Update**: W01 umgesetzt (Branch `feature/w01-frontmatter`): Artikel-Loader, Frontmatter-Schema, Slugs, Datum, Tags, Seiten `/p/<slug>/`; Entscheidungen O2, O13 (teilweise), O21, O26 eingetragen, siehe [Frontmatter](/content/frontmatter.md).
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
