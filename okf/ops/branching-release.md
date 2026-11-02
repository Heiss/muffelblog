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
* **[E]** Release des Codes: Git-Tag `vX.Y.Z`. Die CI baut und veröffentlicht
  die Docker-Images nur auf einem Tag, nicht bei jedem Merge. Der Server
  zieht bewusst eine Version, ein Rollback ist der vorherige Tag.
* **[E]** Inhalte (Artikel, Memos, Mentions) brauchen kein Release. Der
  Scheduler baut sie automatisch (siehe [Pipeline](/ops/pipeline.md)).

# Vorschläge

* **[V]** Branch-Namen: `feature/wNN-<kurzname>`.
* **[V]** Schutz für `main`: Pull Request Pflicht, CI muss grün sein. Keine
  Pflicht-Reviews, weil sie sich bei gleichem Konto von Autor und Prüfer
  selbst blockieren würden (ungeprüft). Die Abnahme ist der Merge durch den
  Nutzer.
* **[V]** Der Go-live ist der Tag `v1.0.0`.
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
* SemVer hat ohne API-Konsumenten wenig Aussagekraft. Ein Wechsel auf CalVer
  wäre gleichwertig und ist als Option erfasst.
