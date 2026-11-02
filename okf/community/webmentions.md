---
type: Feature
title: Webmentions
description: Empfangen über webmention.io, Senden aus Posts und Memos, Anzeige als Remark42-Kommentare.
tags: [webmention, indieweb, remark42]
status: draft
generated: { by: claude-code/web, at: 2026-11-02T12:40:00Z }
sources:
  - id: remark42-create
    resource: https://raw.githubusercontent.com/umputun/remark42/master/backend/app/rest/api/rest_private.go
    title: Remark42 createCommentCtrl
  - id: remark42-comment
    resource: https://raw.githubusercontent.com/umputun/remark42/master/backend/app/store/comment.go
    title: Remark42 Comment, PrepareUntrusted
  - id: remark42-migrator
    resource: https://raw.githubusercontent.com/umputun/remark42/master/backend/app/migrator/native.go
    title: Remark42 nativer Import
---

# Entscheidungen

* **[E]** webmention.io empfängt Mentions.
* **[E]** Mentions werden auch gesendet, aus Posts. Ob aus Memos, ist eine
  Annahme (O12).
* **[E]** Mentions können auf Posts und Memos eingehen.
* **[E]** Die Anzeige erfolgt als Kommentare in Remark42 (Option B), damit Kommentare
  und Mentions in einer Zeitleiste im Widget stehen.
* **[E]** Name der Quellseite als Kommentator und Originaldatum sind
  nicht umsetzbar. Es gilt, was Remark42 zulässt.
* **[E]** Der Browser lädt nichts von webmention.io.

# Warum als Kommentare

Das Remark42-Widget lässt sich nicht von außen um fremde Einträge erweitern.
Ein Import-Weg wäre möglich, löscht aber bei jedem Lauf alle Kommentare der Site
(`DeleteAll` vor dem Schreiben).[^remark42-migrator] Er ist deshalb nicht
vertretbar.

# Verfahren (Vorschlag)

* **[V]** Der Builder fragt webmention.io alle 3 Minuten ab.
* **[V]** Für jede neue Mention postet er einen Kommentar über
  `POST /api/v1/comment` mit Basic Auth als `admin` in das Thema der Zielseite.
* **[V]** Der Kommentartext enthält Markdown mit Namen und Link der Quellseite,
  etwa "Mention von {Seitenname}: {URL}". Die Texte sind vorher
  bereinigt (siehe [Bereinigung](/security/sanitization.md)). Ob Links in
  Remark42-Kommentaren so gerendert werden, ist nicht geprüft.
* **[V]** Der Builder speichert die Zuordnung Mention zu Kommentar-ID, um nicht
  doppelt zu posten und um bei weggefallenen Mentions den Kommentar über
  `DELETE /api/v1/admin/comment/{id}` zu löschen. Wiederherstellung bei
  Verlust des Zustands: siehe O3.

# Was Remark42 vorgibt

* Der Autor ist immer der angemeldete Nutzer, hier `admin`. Ein eigener Name ist
  nicht möglich.[^remark42-create]
* Der Zeitstempel wird zurückgesetzt und neu vergeben, es zählt der Zeitpunkt
  des Postens.[^remark42-comment] Damit ist die Zeit einer Mention der
  Eingangszeitpunkt (bis zu 3 Minuten nach Eintreffen), nicht das Datum der
  Quellseite. Beim ersten Lauf bekämen vorhandene Mentions das aktuelle Datum.
* **[U]** Wie das Widget den Autor `admin` darstellt, ist nicht geprüft.

# Senden

* **[E]** Webmentions werden gesendet, weil das Netzwerk sonst nicht
  funktioniert.
* **[V]** Gesendet wird erst, nachdem der neue Build ausgeliefert ist. Der
  Empfänger ruft die Quell-URL ab und prüft den Link.
* **[V]** Die gesendeten Paare aus Quelle und Ziel werden gespeichert, damit nicht
  bei jedem Rebuild alle Pings erneut rausgehen. Ändert sich ein Post, wird
  erneut gesendet. Wird ein Post entfernt, wird eine Löschbenachrichtigung
  gesendet.
* **[V]** Die Suche nach dem Endpunkt der Ziele ruft fremde Server ab und läuft
  asynchron zum Build, mit Zeitlimits.
* Die Implementierung des Senders ist offen (O11).

# Voraussetzungen

* **[V]** `<link rel="webmention" href="https://webmention.io/<domain>/webmention">`
  und `rel=me`-Links im `<head>` bzw. auf der Seite, IndieAuth-Anmeldung bei
  webmention.io. Das braucht die endgültige Domain.
* **[V]** Microformats (`h-entry`, `h-card`, `u-url`) auf Post- und Memo-Seiten,
  damit Empfänger Titel und Autor lesen können. Das wurde nicht besprochen
  (O11).
* **[U]** Die öffentliche webmention.io-API liefert Mentions ohne Token und
  kennt einen `since`-Parameter. Nicht geprüft.

# Risiken

* Mentions sind Fremdinhalt. Spam und Schadcode: Text wird nur als Text
  gerendert.
* Fällt webmention.io aus, dürfen vorhandene Mentions nicht verschwinden.
  Sie liegen in Remark42 und bleiben dort.
* `ADMIN_PASSWD` im Builder ist ein Master-Schlüssel (siehe
  [Kommentare](/community/comments.md)).

[^remark42-create]: Remark42 createCommentCtrl
[^remark42-comment]: Remark42 Comment, PrepareUntrusted
[^remark42-migrator]: Remark42 nativer Import
