---
type: Policy
title: Teststrategie
description: Verbindliche Testarten, Takt der Contract-Tests und die Rolle der Tests für den Auto-Merge.
tags: [tests, tdd, e2e, contract-tests, ci]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T14:10:00Z }
---

# Entscheidungen

* **[E]** TDD mit Mocks für die Logik: Der Test entsteht zuerst. Das betrifft
  Loader, Frontmatter-Schema, Slugs, Bereinigung, Scheduler und Mention-Sync.
  Externe Dienste werden durch Mocks und Beispielantworten ersetzt.
* **[E]** E2E-Tests im Browser gegen die gebaute Seite.
* **[E]** Contract-Tests gegen echte Testinstanzen (Nextcloud, Memos,
  Remark42, Mail-Sink als Container) laufen **nur vor jedem Tag**, nicht
  nachts und nicht bei jedem Pull Request.
* **[E]** Visuelle Regression gehört nicht dazu.
* **[E]** Hybride Strategie aus O29 bleibt: Mocks in der CI, echte
  Testinstanzen in einer lokalen Compose-Umgebung.

# Zweck gegenüber dem Auto-Merge

Der Nutzer will mit TDD und E2E-Tests das Risiko der automatisch gemergten
Patch-Updates senken (siehe [Branching und Release](/ops/branching-release.md)).
Das gelingt nur für das, was die Tests abdecken.

# Umfang der E2E-Tests (Vorschlag)

* **[V]** Feed zeigt Posts und Memos chronologisch.
* **[V]** Endless Scroll lädt Blöcke ohne Doppelungen nach.
* **[V]** Split-View ab 1024px: Modus, Verhältnis und ausgeblendete Seite
  bleiben nach dem Neuladen erhalten, unter 1024px nur Unified.
* **[V]** `build.json`-Banner erscheint nur bei neueren Einträgen.
* **[V]** Suche liefert Posts und Memos, keine Treffer aus den Blöcken.
* **[V]** Seite funktioniert ohne JavaScript (Weiter-Link, statische
  Kommentare).
* **[V]** Der Browser stellt keine Anfrage an Fremddomains.

# Umfang der Contract-Tests (Vorschlag)

* **[V]** Nextcloud: Public Share per WebDAV mit Token und Passwort,
  Konfliktkopien, Verhalten von `getlastmodified`.
* **[V]** Memos: öffentliche Liste, Anhänge, Felder, die der Loader liest.
* **[V]** Remark42: `find`, Kommentar als `admin` posten, Kommentar löschen,
  Login-Mail im Mail-Sink.
* **[V]** webmention.io lässt sich nicht lokal betreiben. Dort bleibt es bei
  Mocks, ob zusätzlich ein Lesetest gegen den echten Dienst läuft, ist offen
  (O32).

# Regeln

* **[V]** Kein Test wird übersprungen oder deaktiviert, damit die CI grün wird.
* **[V]** Tests prüfen Verhalten, nicht Markup. HTML-Snapshots des
  Astro-Outputs sind nicht die einzige Prüfung.
* **[V]** Der Tag-Workflow führt vorher die Contract-Tests aus. Sind sie rot,
  werden keine Images veröffentlicht.
* **[V]** Pflicht-Checks für `main`: Lint, Typprüfung, Unit-Tests, E2E-Tests und
  Build. Die Contract-Tests sind kein Pflicht-Check.

# Risiken

* **Brüche fallen spät auf:** Ein Remark42-Patch, den Renovate automatisch
  nach `main` merged, wird erst vor dem nächsten Tag gegen eine echte Instanz
  geprüft.
* **Betrieb gegen Testinstanzen:** Im Betrieb läuft der Builder gegen die
  echten, jeweils neuesten Memos- und Nextcloud-Instanzen. Eine Änderung
  dort ändert die API unabhängig von unserem Code. Die Contract-Tests vor dem
  Tag zeigen das nur, wenn die Testinstanzen dieselbe Version haben. Sonst
  bleibt als Schutz die Regel "bei Abruffehler bleibt die letzte gute Version
  online" und das Alerting (O18).
* **Mocks driften:** Sie bleiben grün, wenn sich die echte API ändert. Das
  sehen nur die Contract-Tests, in unserem Takt also erst vor dem Tag.
* **Nicht abgedeckt:** Datenbankmigrationen von Remark42 und die Zustellung
  der Login-Mails über Migadu prüft kein Mock und kein Browser-Test.
* **Flaky E2E:** Wackelige Tests halten alle Renovate-PRs auf.
