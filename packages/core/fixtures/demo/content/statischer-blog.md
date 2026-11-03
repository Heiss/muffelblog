---
publish: true
title: 'Warum ein statischer Blog genügt'
date: 2026-08-14 09:30
tags: [it, web, hosting]
description: 'Ein statischer Blog besteht aus fertigen Dateien. Das macht ihn schnell, sicher und billig zu betreiben.'
---

Ein statischer Blog besteht aus fertigen HTML-Dateien. Es gibt keine Datenbank und keinen Code, der bei jedem Aufruf läuft. Der Server liefert nur Dateien aus.

Das hat drei Vorteile:

- **Tempo:** Die Seiten liegen fertig vor und lassen sich direkt ausliefern oder zwischenspeichern.
- **Sicherheit:** Wo kein Code läuft, gibt es wenig anzugreifen.
- **Betrieb:** Ein Backup ist ein Ordner, der Umzug ein Kopiervorgang.

Der Preis: Alles, was Laufzeit braucht, etwa Kommentare, kommt von außen oder aus dem Browser. Für einen persönlichen Blog ist das ein guter Tausch.

![Ablauf: Text, Build, Dateien, Server](bilder/build-ablauf.jpg)

Der ganze Ablauf passt in zwei Zeilen:

```bash
pnpm build
rsync -a dist/ server:/var/www/blog/
```
