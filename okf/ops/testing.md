---
type: Policy
title: Teststrategie
description: Verbindliche Testarten, Werkzeuge, Takt der Suite und die Rolle der Tests für Pflicht-Checks und Auto-Merge.
tags: [tests, tdd, e2e, contract-tests, ci, vitest, playwright]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T14:40:00Z }
---

# Entscheidungen

* **[E]** TDD mit Mocks für die Logik: Der Test entsteht zuerst. Das betrifft
  Loader, Frontmatter-Schema, Slugs, Bereinigung, Scheduler und Mention-Sync.
  Externe Dienste werden durch Mocks und Beispielantworten ersetzt.
* **[E]** Unit-Tests mit Vitest.
* **[E]** E2E-Tests mit Playwright, im Browser gegen die gebaute Seite.
* **[E]** Contract-Tests gegen echte Testinstanzen (Nextcloud, Memos,
  Remark42, Mail-Sink als Container).
* **[E]** Die gesamte Suite läuft bei jedem Pull Request, damit kein Fehler in
  `main` gelangt. Das ersetzt die frühere Fassung "Contract-Tests nur vor
  jedem Tag".
* **[E]** Die Testinstanzen sind gepinnt. Renovate aktualisiert ihre
  Versionen per Pull Request, und diese Pull Requests durchlaufen die volle
  Suite.
* **[E]** Der Tag-Workflow führt die Suite erneut aus, bevor Images
  veröffentlicht werden.
* **[E]** Reine Dokumentations-PRs (nur `okf/` oder README) werden über einen
  Gate-Job mit Pfaderkennung behandelt: Der Pflicht-Check läuft immer, startet
  die schweren Tests aber nur, wenn Code betroffen ist.
* **[E]** Visuelle Regression gehört nicht dazu.

# Zweck

Der Nutzer will mit TDD, E2E- und Contract-Tests das Risiko von Fehlern in
`main` und der automatisch gemergten Patch-Updates senken (siehe
[Branching und Release](/ops/branching-release.md)). "Fehlerfrei" bedeutet
dabei nur: frei von dem, was die Tests sehen.

# Umfang der E2E-Tests (Vorschlag)

* **[V]** Feed zeigt Posts und Memos chronologisch.
* **[V]** Endless Scroll lädt Blöcke ohne Doppelungen nach.
* **[V]** Split-View ab 1024px: Modus, Verhältnis und ausgeblendete Seite
  bleiben nach dem Neuladen erhalten, unter 1024px nur Unified.
* **[V]** `build.json`-Banner erscheint nur bei neueren Einträgen.
* **[V]** Suche liefert Posts und Memos, keine Treffer aus den Blöcken.
* **[V]** Seite funktioniert ohne JavaScript (Weiter-Link, statische
  Kommentare).
* **[V]** Startseite und Artikel ohne Fremdinhalt stellen keine Anfrage an
  Fremddomains. Artikel mit Fremdinhalt rufen nur freigegebene Hosts auf,
  Einbettungen erst nach dem Klick.

# Umfang der Contract-Tests (Vorschlag)

* **[V]** Nextcloud: Public Share per WebDAV mit Token und Passwort,
  Konfliktkopien, Verhalten von `getlastmodified`.
* **[V]** Memos: öffentliche Liste, Anhänge, Felder, die der Loader liest.
  Umgesetzt als `packages/core/contract/memos.contract.test.ts` und CI-Job
  "Contract-Tests" mit einer Memos-Instanz als Service-Container
  (`neosmemo/memos:26.11.0`, das Tag ist aus der Release-Konfiguration
  abgeleitet, nicht geprüft). Der Test legt den ersten Benutzer an, stellt den
  Zugriffsmodus auf PUBLIC und erzeugt Memos mit Anhang.
* **[V]** Remark42: `find`, Kommentar als `admin` posten, Kommentar löschen,
  Login-Mail im Mail-Sink.
* **[V]** webmention.io lässt sich nicht lokal betreiben. Dort bleibt es bei
  Mocks. Ob zusätzlich ein Lesetest gegen den echten Dienst läuft, ist offen
  (O32).

# Regeln

* **[V]** Kein Test wird übersprungen oder deaktiviert, damit die CI grün wird.
* **[V]** Tests prüfen Verhalten, nicht Markup. HTML-Snapshots des
  Astro-Outputs sind nicht die einzige Prüfung.
* **[V]** Pflicht-Checks für `main`: der Gate-Job, der je nach Änderung Lint,
  Typprüfung, Unit-, E2E- und Contract-Tests und den Build auslöst. Der Gate-
  Job ist immer vorhanden, damit GitHub den Merge nicht wegen eines
  fehlenden Checks blockiert.
* **[V]** Der Tag-Workflow baut Images erst nach grüner Suite.

# Risiken

* **Laufzeit und Kosten:** Nextcloud, Memos, Remark42 und der Mail-Sink starten
  in jedem Lauf, auch bei jedem Renovate-PR. Ob das Repo öffentlich ist,
  entscheidet über die verfügbaren CI-Minuten (O34).
* **Wackelige Tests blockieren alles:** Eine instabile Contract- oder E2E-
  Prüfung hält jeden PR und jedes automatische Update auf. Überspringen ist
  verboten, die Tests müssen also stabil sein.
* **Gepinnte Testinstanzen gegen "neueste" im Betrieb:** Im Betrieb laufen die
  echten Memos- und Nextcloud-Instanzen in der jeweils neuesten Version.
  Eine API-Änderung dort fällt in der Suite erst auf, wenn Renovate die
  gepinnte Testversion anhebt (frühestens nach 3 Tagen Wartezeit). In der
  Zwischenzeit schützen nur die Regel "bei Abruffehler bleibt die letzte
  gute Version online" und das Alerting (O18). Ein Nachtlauf gegen `latest`
  wurde bewusst nicht gewählt.
* **Mocks driften:** Sie bleiben grün, wenn sich die echte API ändert. Das
  sehen nur die Contract-Tests.
* **Nicht abgedeckt:** Datenbankmigrationen von Remark42 beim Wechsel einer
  Version und die Zustellung der Login-Mails über Migadu prüft weder ein Mock
  noch ein Browser-Test. Der Mail-Sink prüft den Versand, nicht die
  Zustellbarkeit.
* **Semantische Konflikte:** Zwei gleichzeitig grüne PRs können zusammen
  einen Fehler in `main` erzeugen. Die Branch-Protection-Option "Branch muss
  aktuell sein" verhindert das, kostet bei vielen Renovate-PRs aber
  Neuaufsetzen (O33).
