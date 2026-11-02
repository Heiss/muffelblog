---
type: Process
title: Branching und Release
description: Branching-Modell, Merge-Art und Release-Verfahren für Code, Images und Compose-Konfiguration.
tags: [git, branching, release, ci]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T13:40:00Z }
---

# Entscheidungen

* **[E]** Branching-Modell: GitHub Flow.
  * `main` ist immer auslieferbar.
  * Ein kurzlebiger Branch pro Arbeitspaket der [Roadmap](/roadmap.md), ein Pull
    Request gegen `main`, danach wird der Branch gelöscht.
* **[E]** Pull Requests werden per Squash-Merge gemergt: ein Commit pro
  Arbeitspaket, lineare Historie.
* **[E]** Release des Codes: Git-Tag in CalVer `YY.M.MICRO`, zum Beispiel
  `26.11.0` oder `26.1.0`, ohne `v`-Präfix. `YY` ist das Jahr zweistellig, `M`
  der Monat ohne führende Null, `MICRO` zählt die Releases innerhalb des
  Monats ab 0. Die Form ist gültiges SemVer (Major = Jahr, Minor = Monat,
  Patch = Zähler), damit Auto-Updater die Tags verstehen. Es gibt keine API,
  die jemand einbindet, deshalb zählt das Alter der Version, nicht die
  Kompatibilität. Git-Tag und Image-Tag sind identisch.
* **[E]** Die CI baut und veröffentlicht die Docker-Images nur auf einem Tag,
  nicht bei jedem Merge. Der Server zieht bewusst eine Version, ein Rollback
  ist der vorherige Tag.
* **[E]** Inhalte (Artikel, Memos, Mentions) brauchen kein Release. Der
  Scheduler baut sie automatisch (siehe [Pipeline](/ops/pipeline.md)).

# Vorschläge

* **[V]** Branch-Namen: `feature/wNN-<kurzname>`.
* **[V]** Schutz für `main`: Pull Request Pflicht, CI muss grün sein. Keine
  Pflicht-Reviews, weil sie sich bei gleichem Konto von Autor und Prüfer
  selbst blockieren würden (ungeprüft). Die Abnahme ist der Merge durch den
  Nutzer.
* **[V]** Remark42-Upgrades laufen als eigenes Release mit einem Backup
  davor, weil Datenbankänderungen nicht ohne Backup rückgängig zu machen sind.
* **[V]** Abhängige Arbeitspakete (zum Beispiel W01, W03, W04) werden
  nacheinander gemergt: Der Vorgänger kommt zuerst nach `main`, dann wird der
  Folge-Branch davon aufgesetzt. Das vermeidet Konflikte durch Squash-Merge
  bei gestapelten Branches.

# Default-Branch

Der Default-Branch von GitHub ist derzeit der Branch `ccr-01da7c96-avlx2l`
(geprüft mit `git remote show origin`), weil er als erster gepusht wurde.
Gewünscht ist `main`. Die Umstellung erfolgt in GitHub unter
Settings → Branches → Default branch. Erst danach lässt sich der
Sitzungs-Branch löschen.

# Risiken

* Ein fehlerhaftes Builder-Release stoppt die Inhalts-Updates, ohne dass die
  Seite ausfällt. Die Regel "letzte gute Version bleibt online" und das Alerting
  (O18) fangen das ab.
* Mit Tags und Images auf Tag braucht es eine Registry (O10). Die Registry ist
  noch nicht gewählt.
* Parallele Pull Requests ändern alle `okf/log.md` und `okf/open-points.md`.
  Konflikte dort sind wahrscheinlich und werden per Rebase gelöst.
* CalVer sagt nichts über Brüche aus. Für diesen Dienst ist das gewollt, denn
  es gibt keine Konsumenten. Ein Bruch, der Betrieb oder Konfiguration
  betrifft (zum Beispiel ein neues Secret), gehört deshalb in die
  Release-Notiz des Tags.
* Ohne führende Null im Monat sortiert eine reine Textsortierung falsch
  (`26.10.0` vor `26.9.0`). SemVer-fähige Werkzeuge vergleichen numerisch und
  sind nicht betroffen.
* Updater leiten Major, Minor und Patch aus der Position ab. Der Jahreswechsel
  (`26.12.0` zu `27.1.0`) gilt als "Major", ein Monatswechsel als "Minor". Für
  unsere eigenen Images ist das heute ohne Folgen, weil keine Updater sie
  verwenden (siehe unten).
* Mit höchstens einem Release pro Monat bleibt `MICRO` bei 0. Mehrere Releases
  im selben Monat zählen hoch. Der Zähler beginnt jeden Monat neu bei 0.

# Auto-Updater

* **[E]** Ein Auto-Updater öffnet Pull Requests für Fremd-Images (Remark42,
  Caddy, Node-Basisimages) und für Abhängigkeiten des Astro-Projekts (pnpm).
  Du nimmst sie ab.
* **[E]** Kein automatisches Ziehen und Starten von Images auf dem Server. Der
  Server zieht bewusst eine Version.
* **[E]** Für eigene Images gibt es keinen Updater, denn es gibt kein
  getrenntes Deploy-Repo. Falls das später kommt, ist die SemVer-gültige
  Form der Tags bereits passend.
* Welches Werkzeug (Renovate oder Dependabot) und welche Regeln für
  automatisches Zusammenführen gelten, ist offen (O31).
