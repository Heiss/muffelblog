---
type: Feature
title: Live-Update über build.json
description: Erkennung neuer Builds durch Abfrage einer kleinen Datei und Banner "N neue Einträge".
tags: [build-json, polling, frontend]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
---

# Entscheidungen

* **[E]** Polling einer kleinen Datei `build.json`, kein SSE, kein WebSocket.
  Es gibt keine Dauerverbindungen für Besucher.
* **[E]** Der Client zeigt ein Banner "N neue Einträge", wenn neue Einträge da
  sind. Ein Klick scrollt ganz nach oben und zeigt sie an.
* **[E]** Das Banner zählt nur Einträge, die neuer sind als der neueste bereits
  geladene. Zurückdatierte Einträge erscheinen erst beim nächsten Laden.
* **[V]** Der Client prüft nur bei sichtbarem Tab.

# Inhalt von build.json

**[V]**

```json
{
  "build": "<Build-ID>",
  "entries": [
    { "id": "post:<slug>", "date": "<ISO 8601>" },
    { "id": "memo:<uid>",  "date": "<ISO 8601>" }
  ]
}
```

`entries` enthält die neuesten N Einträge (Vorschlag: 20), damit der Client
die Zahl neuer Einträge ohne Nachladen der Seite berechnen kann. Sind mehr als
N neu, zeigt das Banner "N+ neue Einträge". Die Build-ID ändert sich bei jedem
Build, auch wenn sich nur Kommentare oder Mentions geändert haben. Der Client
vergleicht deshalb die Eintrags-IDs, nicht nur die Build-ID.

# Abfrage

* **[V]** `cache: 'no-cache'` mit ETag: Der Server antwortet meist mit 304.
* **[V]** Intervall 60 Sekunden bei sichtbarem Tab, der Scheduler läuft alle 3
  Minuten (siehe [Pipeline](/ops/pipeline.md)). Der Nutzer hatte "3 Minuten" für
  die Intervalle genannt. Die 60 Sekunden für den Client sind ein Vorschlag.
* **[V]** Beim Klick auf das Banner werden die neuen Einträge von `/seite/1/`
  geholt und oben eingefügt, danach scrollt die Seite nach oben.
* **[V]** Wird beim Abruf die Build-ID geändert, aber es gibt keine neuen
  Einträge, bleibt das Banner aus.

# Risiken

* `build.json` muss als letzte Datei eines Builds erscheinen (siehe
  [Docker](/architecture/docker.md)), sonst melden Clients einen neuen Stand,
  bevor die Seiten vollständig sind.
* Alte Tabs referenzieren gehashte Assets, die nach einem Build fehlen können.
  Frühere Releases bleiben deshalb eine Weile erhalten.
* Last: 100 gleichzeitige Besucher bei 60 s Intervall sind etwa 1,7 Abfragen
  pro Sekunde, fast alle mit 304.
