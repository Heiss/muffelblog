---
type: Feature
title: Glossar und Wissensgraph
description: Glossareinträge als dritte Inhaltsart im Feed mit Buchstabenansicht, Suche, Verlinkung zwischen Begriffen und Beiträgen und einem Wissensgraphen.
tags: [glossar, graph, backlinks, verlinkung]
status: draft
generated: { by: claude-code/web, at: 2026-11-03T12:30:00Z }
---

# Entscheidungen

* **[E]** Es gibt ein Glossar nach dem Vorbild von newworkglossar.de. Der Nutzer
  hat den HTML-Quelltext der Startseite eingefügt; die Seite selbst war aus
  der Sitzung nicht erreichbar. Beobachtet ist nur die Startseite, **nicht**
  eine einzelne Begriffsseite.
* **[E]** Neue Glossareinträge erscheinen im zeitlichen Verlauf des Blogs. Dazu
  gibt es eine Auswahl nach Buchstaben und die Suche.
* **[E]** Quelle ist derselbe Nextcloud-Ordner. Eine Markdown-Datei mit dem
  Frontmatter-Feld `type: glossary` ist ein Glossareintrag (Feldname und Wert
  englisch wie die übrigen Felder, entschieden am 2026-11-03). Pipeline, Rendering
  und Bereinigung sind dieselben wie bei Artikeln.
* **[E]** Verlinkung geschieht mit normalen Markdown-Links auf eigene Seiten,
  nicht mit Wikilinks. Die Regel "Wikilink = Datei überspringen" bleibt.
* **[E]** Ein Wissensgraph zeigt die Verlinkung zwischen Begriffen und
  Beiträgen: ein lokaler Graph je Seite und eine Gesamtansicht `/graph/`.
* **[E]** Filter im Feed: Alle, **Lang** (Blogbeiträge), **Kurz** (Memos) und
  **Begriffe** (Glossar). Begriffe werden getrennt von den Blogbeiträgen
  geführt: `Lang` enthält nie Begriffe. In **Alle** erscheinen Begriffe im
  zeitlichen Verlauf, eigens als Begriff gekennzeichnet. Die Reihe heißt
  `/begriffe/` und `/begriffe/seite/N/`.
* **[E]** Die Split-View entfällt. Der Unified-Modus mit Filter bleibt die
  einzige Ansicht des Feeds (siehe [Feed](/frontend/feed.md)).

# Beobachtungen am Vorbild (Startseite)

* Kopf mit Logo und einem Satz zum Zweck, darunter eine Leiste A bis Z. Die
  Buchstaben sind dort `span`-Elemente, keine Links (Sprung per Skript).
* Darunter alle Begriffe, nach Buchstaben gruppiert, je Buchstabe eine
  Überschrift mit `id` (`A` bis `Z`). Jeder Eintrag ist ein Link auf eine
  eigene Seite.
* Der Linktext ist eine **Frage** ("Was ist Agilität?", "Wie funktioniert
  Selbstorganisation?"), der Begriff darin ist hervorgehoben. Die Gruppierung
  folgt dem Begriff, nicht dem Fragewort.
* Die URL leitet sich aus der Frage ab (`/was-ist-agilitaet/`), liegt direkt
  an der Wurzel, mit Umlauten als `ae`, `oe`, `ue`.
* Begriffe mit Sonderzeichen stehen unter dem ersten Buchstaben (`Coach*in`
  unter C). Es gibt keine Daten, keine Tags und keinen Graphen auf der
  Startseite. Einzelne Begriffe stehen nicht streng alphabetisch (zum Beispiel
  "self-made man" am Ende von S).
* Fußzeile mit Datenschutz, Impressum und weiteren Links. Das Vorbild bindet
  Fremdskripte ein (Cookie-Banner, Formular-Einbettung). Das übernehmen wir
  nicht.

# Vorschlag: Glossar

* **[V]** URL eines Begriffs: `/g/<slug>/`. Der Slug entsteht wie bei Artikeln
  aus dem Titel, bei Doppelungen innerhalb des Glossars mit Zähler. Der
  Namensraum ist von `/p/` getrennt, ein Begriff kann also nie einen Artikel
  verdrängen.
* **[V]** Felder wie bei Artikeln (`title`, `date`, `tags`, `description`,
  `publish`) plus ein optionales Feld für den Begriff. Der Titel darf wie im
  Vorbild eine Frage sein ("Was ist Agilität?"). Der Begriff ("Agilität")
  bestimmt Buchstabe und Sortierung und wird im Titel hervorgehoben. Fehlt das
  Feld, gilt der Titel als Begriff. Die Beschreibung ist die Kurzdefinition
  für den Feed-Auszug.
* **[V]** Der Feed bekommt eine dritte Art `glossar` und einen vierten Filter.
  Ein Eintrag zeigt Begriff, Datum und Kurzdefinition, nicht den ganzen Text.
* **[V]** Buchstabenansicht `/glossar/`: Leiste A bis Z und alle Begriffe nach
  Anfangsbuchstaben des Begriffs gruppiert. Die Buchstaben der Leiste sind
  echte Links (Sprungmarken), nicht nur Skript-Elemente. Umlaute zählen zum Grundbuchstaben (Ä unter A),
  Ziffern und Sonderzeichen unter `#`. Die Seite ist statisch und vollständig,
  bei der erwarteten Menge (einige hundert Begriffe) reicht eine Seite.
* **[V]** Die Suche findet Begriffe über Pagefind, mit Filter nach Art. RSS und
  Sitemap enthalten Begriffe.

# Vorschlag: Verlinkung und Graph

* **[V]** Ein Markdown-Link auf eine Datei im Ordner (relativer Pfad, zum
  Beispiel `Datei.md` oder `../ordner/Datei.md` als Ziel) wird
  beim Build gegen die veröffentlichten Dateien aufgelöst und zur Seite des
  Ziels (`/p/<slug>/` oder `/g/<slug>/`). Das ist **neues Verhalten**: der
  Renderer lässt relative Links heute unverändert. Ein Link auf eine
  unbekannte oder nicht veröffentlichte Datei wird zu reinem Text und erzeugt
  eine Warnung.
* **[V]** Knoten sind Artikel und Begriffe. Memos sind keine Knoten, sie haben
  keinen Titel und werden im strengen Modus bereinigt. Kanten sind aufgelöste
  Links, gerichtet, ohne Doppelte und ohne Selbstbezug.
* **[V]** Jede Seite zeigt zwei Listen: "Verweist auf" und "Verlinkt von"
  (Backlinks). Die Listen sind reines HTML und der Zugang ohne JavaScript, für
  Screenreader und Suchmaschinen.
* **[V]** Der Build schreibt `graph.json` (Knoten mit Art, Titel, URL; Kanten).
  Der Browser zeichnet daraus per kleinem Vanilla-TS einen Graphen als SVG,
  lokal mit den direkten Nachbarn, in `/graph/` vollständig. Keine
  Fremdbibliothek, keine Anfrage an Dritte.
* **[V]** Veröffentlichung schützt: Kanten zu Dateien ohne `publish: true`
  entstehen nie. Sonst würden Titel und Slug unveröffentlichter Dateien über
  `graph.json` abfließen.

# Risiken

* **Wert des Graphen:** Bei wenigen Knoten ist der Graph Dekoration. Den
  Nutzen tragen die Backlink-Listen. Der Graph wird erst sinnvoll, wenn sich
  Begriffe und Beiträge dicht verlinken.
* **Obsidian-Einstellung:** Obsidian erzeugt Markdown-Links nur, wenn
  "Use Wikilinks" aus ist (siehe [Nextcloud-Quelle](/content/nextcloud-source.md)).
  Der Graph aus Obsidian selbst ist davon unberührt.
* **Pfade im Link:** Obsidian kodiert Leerzeichen als `%20`. Die Auflösung muss
  das dekodieren und gegen Unicode-Normalisierung (NFC) abgleichen.
* **Größe von `graph.json`:** wächst mit Knoten und Kanten. Bei der erwarteten
  Menge unkritisch, ein Schwellwert wird in W21 festgelegt.

# Offen

Siehe O38 in [Offene Punkte](/open-points.md): Kommentare und Webmentions auf Begriffen, Sortierung der
Umlaute, Frageform des Titels und Name des Begriff-Felds, Anzeige von Memos im
Graph, Aufbau einer einzelnen Begriffsseite im Vorbild (unbeobachtet).
