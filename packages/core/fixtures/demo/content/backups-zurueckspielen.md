---
publish: true
title: 'Backups, die man wirklich zurückspielt'
date: 2026-09-20 18:00
tags: [it, backup, alltag]
description: 'Ein Backup zählt erst, wenn die Wiederherstellung einmal geklappt hat. Die 3-2-1-Regel hilft bei der Planung.'
---

Ein Backup, das nie zurückgespielt wurde, ist nur eine Hoffnung. Deshalb gehört der Test dazu: einmal ein paar Dateien an einen anderen Ort wiederherstellen und nachsehen, ob alles da ist.

Als Faustregel gilt **3-2-1**: drei Kopien, auf zwei verschiedenen Medien, eine davon außer Haus.

| Variante           | Vorteil                   | Nachteil                          |
| ------------------ | ------------------------- | --------------------------------- |
| Externe Festplatte | schnell und billig        | steht meist im selben Haus        |
| Cloud-Speicher     | außer Haus                | braucht Zugang und kostet laufend |
| Zweiter Rechner    | lässt sich automatisieren | will gepflegt werden              |

Mit `restic` sieht der Test so aus:

```bash
restic -r /mnt/backup snapshots
restic -r /mnt/backup restore latest --target /tmp/restore
```

Danach ein paar Stichproben vergleichen. Erst dann ist das Backup eines.
