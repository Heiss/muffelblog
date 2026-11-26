---
type: Feature
title: Layout
description: Page structure chosen by the owner on the layout board (2026-11-25/26) - sidebar frame, timeline feed, post, term and memo pages, overviews, bottom bar on phones.
tags: [layout, design, navigation, frontend, mobile]
status: draft
generated: { by: claude-code/web, at: 2026-11-26T08:00:00Z }
---

# Occasion

The owner asked for a nicer structure (2026-11-25). Claude researched current
UX advice for blogs and minimal sites and built a layout board: a private
claude.ai page with mockups that use the live content of netzmuffel.de, in all
ten themes, for desktop and phone. The owner rated them in four rounds
(favourite, good, unsure, no) and answered follow-up questions. This concept
records the result. Codes such as R2, G1 or K3 name the mockups on the board.

# Starting point (netzmuffel.de, measured 2026-11-25)

* Under "All" 413 terms of 13 Nov stand between the posts and the memos; the
  newest memo is entry 417, in block 21 of 22.
* Seven header links and the theme select need two lines at 1440 px (header
  110 px high, 162 px on a phone). The first entry starts at 312 px (phone
  364 px): the site name appears twice, filter and sort take two rows of
  buttons.
* All entries are the same box; five bordered tags per entry. The text column
  is 736 px wide, about 81 characters per line at 17 px.
* A memo's title "Memo vom 11. Aug. 2026, 07:56" is larger than its text.
* The footer starts at x = 0, the content at x = 336.
* `/graph/` labels of 400+ nodes overlap; the glossary letter bar is one
  underlined word without gaps.

# Decisions

## Frame (R2)

* **[E]** On wide screens a sidebar on the left replaces the header: name,
  counts (posts, memos, terms), search field and navigation (Start, Glossary,
  Graph, Tags, Files, Comments) at the top; the tools of the current page in
  the middle; theme picker and footer links (FAQ, Glossary, RSS) at the bottom.
* **[E]** The theme picker sits in the sidebar (answer to "where does the theme
  choice go": "in the footer or the sidebar").
* **[E]** The middle of the sidebar holds the page's own tools: filter and sort
  on the feed, the table of contents on a post, letters and a term filter on
  the glossary, node search, kind filters, focus and neighbours on the graph
  (favourites G1, K3, G4, G5).
* **[E]** Footer links are always reachable, so the problem "endless scroll
  hides the footer" ([Feed](/frontend/feed.md)) is solved by the frame.

## Phones (H3)

* **[E]** Under the phone width the sidebar goes away: a slim top bar with the
  name, and a fixed bar at the bottom with **Start, Glossary, Tags, Search** and
  **Menu** (answer to the bottom bar question). Everything else (Graph, Files,
  Comments, FAQ, theme, RSS) is in the menu.
* **[E]** Search belongs at the bottom, not in the top bar (owner's comment on
  H3: "search too far up").
* **[E]** "Search" in the bottom bar opens a panel that slides in from the
  right over the page: the field at its top, results below, the bottom bar
  stays visible (J4, favourite; J3, a field rising from the bottom, was rated
  unsure).

## Feed (G1, timeline)

* **[E]** Timeline: a date column on the left, the date once per day; the
  entries hang on a vertical line; the kind is shown by the marker (diamond:
  Lang, circle: Kurz, square: Begriffe) and the kind word above the entry
  (F2 and G1, favourites).
* **[E]** The line runs through without gaps (owner's comment on H2,
  2026-11-26).
* **[E]** No horizontal rule across the width between days: tried as J1 and
  rejected by the owner (2026-11-26).
* **[E]** Each day is a zone; the zones alternate between the background and
  the light tint (`--tint`) and touch without a gap (L3, favourite: "good
  highlighting").
* **[E]** The date stays at the top while its day scrolls by (owner's wish on
  L3, liked in L2). The line is drawn above the sticky date, so it never
  breaks; in L2 the date covered the line and left a gap, which the owner
  rejected. The combination is mockup N1 (favourite); a ring per day on the
  line (L1) was rejected.
* **[E]** The terms of one day are bundled into one entry: "413 new terms:
  Accelerate (Buch), …, show all" (answers 2026-11-25). This changes
  "purely chronological, one stream", see [Feed](/frontend/feed.md).
* **[E]** A long post shows its full text up to the first heading, however long
  it is (answers 2026-11-25); the link under it names the next heading
  ("Continue with ›Teil A: …‹"). Real lengths today: 208, 556 and 1344
  characters. This replaces the excerpt of at most 200 characters in the feed
  (O20).
* **[V]** A post without any heading therefore appears in full (follows from the
  rule; not asked separately).
* **[E]** Memos appear in full; their text is a little larger than the text of
  posts (G1).
* **[V]** Tags are plain `#tag` text links, no bordered boxes (all favourites
  show them so; not asked separately).

## Post page (K3)

* **[E]** The text column in the middle; the table of contents in the sidebar;
  margin notes (Document Comments and footnotes) on the right, next to their
  paragraph (answer: "the margin note on the right" is what the owner liked);
  local graph, "Linked from" and "Links to" as a band below the text, before the
  comments. Matches [Notes in the margin](/features/margin-notes.md).
* **[E]** Desktop: comments and footnotes stand open in the margin; phones:
  both closed below their paragraph, a tap opens them (E2, favourite, owner's
  comment 2026-11-26).

## Term page (G3)

* **[E]** The same template as a post, marked by a stripe in the accent colour
  and the kind word. Below the text the band: local graph on the left, "Linked
  from", "Links to" and "Further reading" on the right (owner: "clear split of
  text and graph / appendix with links").

## Memo page (H1)

* **[E]** The same template, a grey stripe. Date and time are a small heading
  instead of "Memo vom …"; the text is a little larger.
* **[E]** Below the text a band "More with #tag": the newest memos that share a
  tag with this memo, all tags mixed, newest first (answer 2026-11-26).
* **[E]** Beside it the links of the memo: local graph and "Links to" (J2,
  favourite).
* **[E]** The band can be folded behind one line that says what is in it
  ("More: 8 memos with #selfhost · 1 link"; owner's wish on J2, shown as N2,
  favourite). The default
  state, and whether term and post pages fold the same way, are open (O40).

## Overviews

* **[E]** Glossary (G4): letters A to Z and `#` as a grid in the sidebar, a term
  filter below them; the list in two columns, each term with its short
  definition. On phones the letters are a row that scrolls sideways above the
  list.
* **[E]** Graph (G5): the graph takes the whole area; node search, kind filters,
  focus and the list of neighbours sit in the sidebar. It opens focused on one
  entry with its neighbours named, all other nodes faded, and a button "show the
  whole graph".
* **[V]** Which entry is in focus when `/graph/` opens (last visited, searched,
  or the newest post) is not decided.
* **[E]** Tags: a weighted cloud, alphabetical, font size by count on a
  logarithmic scale, the count small behind each tag (U4, favourite).
* **[V]** A switch to the list view (U3, rated good) stays, cloud first (the U4
  mockup had the switch; not asked separately).

## Themes

* **[E]** All ten themes stay. The structure above is the same in every theme;
  themes still differ only in CSS ([Themes](/frontend/themes.md)).

## Final set on the board

* The board's last round (E1 to E9) shows every page in the chosen form with
  the phone bottom bar, and a post with an open Document Comments thread and a
  footnote (E2). The owner's verdict after round 7: "I think we have it."
* **[V]** The phone menu (Graph, Files, Comments, FAQ, theme, RSS) slides in
  from the right like the search; not rated yet.

## Rejected on the board

* R1 (one header line with "More"), F3 (compact one-line index: "you have to
  open everything to read it"), M1 (separate templates: memo card and lexicon
  entry), H2 (memo inside an excerpt of the timeline: "nice, but useful?"),
  J1 (full-width rule between days), L1 (ring per day on the line), L2 (short
  tick whose sticky date broke the line).

# Research behind the proposals

* Line length 50 to 75 characters, text from 16 px, line height about 1.5
  ([UXPin](https://www.uxpin.com/studio/blog/optimal-line-length-for-readability/)).
* Hidden navigation is found much less often; keep few top-level targets
  visible ([NN/g](https://www.nngroup.com/articles/hamburger-menus/),
  [NN/g mobile](https://www.nngroup.com/articles/mobile-navigation-patterns/)).
* Endless scroll makes the footer unreachable
  ([NN/g](https://www.nngroup.com/articles/infinite-scrolling-tips/)).
* Short notes get their own form in a mixed stream
  ([SAP Fiori timeline](https://www.sap.com/design-system/fiori-design-web/v1-38/ui-elements/timeline/usage)).
* Notes in the margin next to the paragraph, folded on narrow screens
  ([Tufte CSS](https://github.com/edwardtufte/tufte-css)).
* Backlinks and a local graph beside the text; the overall graph is often
  decoration ([digital gardeners](https://github.com/MaggieAppleton/digital-gardeners),
  [critique](https://stereobooster.netlify.app/posts/digital-garden-as-static-website)).

# Open points

O40 to O47 in [Open points](/open-points.md), section E; O46 and O48 settled
(section C).
