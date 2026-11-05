import type { Messages } from './types.ts';

/** German UI texts. */
export const de: Messages = {
  lang: 'de',
  locale: 'de-DE',
  nav: {
    label: 'Hauptnavigation',
    home: 'Start',
    tags: 'Tags',
    glossary: 'Glossar',
    graph: 'Graph',
    files: 'Dateien',
    search: 'Suche',
  },
  files: {
    title: 'Dateien',
    intro:
      'Alle veröffentlichten Beiträge, Begriffe und Seiten, in den Ordnern, in denen sie geschrieben sind.',
    none: 'Noch keine Dateien.',
    count: (count: number) => (count === 1 ? '1 Datei' : `${count} Dateien`),
  },
  graph: {
    title: 'Graph',
    intro:
      'Wie Beiträge, Begriffe und Memos untereinander und auf andere Websites verlinken. Jede andere Website ist ein Punkt.',
    linksTo: 'Verlinkt auf',
    linkedFrom: 'Verlinkt von',
    local: 'Links dieser Seite',
    needsJs:
      'Die Zeichnung braucht JavaScript; die Listen der Links funktionieren ohne.',
    empty: 'Noch keine Links.',
    kinds: {
      post: 'Beitrag',
      glossary: 'Begriff',
      memo: 'Memo',
      domain: 'Website',
    },
  },
  search: {
    title: 'Suche',
    placeholder: 'Suchen …',
    kind: 'Art',
    tag: 'Tag',
    needsJs: 'Die Suche braucht JavaScript.',
    unavailable: 'Der Suchindex ist nicht verfügbar. Er entsteht beim Build.',
    summary: {
      none: 'Keine Treffer für „{term}“.',
      one: '1 Treffer für „{term}“.',
      many: '{count} Treffer für „{term}“.',
    },
    all: 'Alle',
  },
  comments: {
    title: 'Kommentare',
    needsJs: 'Die Kommentare brauchen JavaScript.',
    unavailable: 'Die Kommentare konnten nicht geladen werden.',
    deleted: 'Dieser Kommentar wurde gelöscht.',
  },
  footer: {
    label: 'Fußbereich',
    rss: 'RSS',
    glossary: 'Glossar',
  },
  notFound: {
    title: 'Seite nicht gefunden',
    text: 'Diese Seite gibt es nicht (mehr).',
    home: 'Zur Startseite',
  },
  rss: {
    description: 'Beiträge, Kurznotizen und Begriffe',
  },
  theme: {
    label: 'Farbschema',
    names: { hell: 'Hell' },
  },
  filter: {
    label: 'Filter',
    all: 'Alle',
    long: 'Lang',
    short: 'Kurz',
    terms: 'Begriffe',
  },
  og: {
    post: 'Beitrag',
    memo: 'Memo',
    term: 'Begriff',
    alt: (title: string) => `Vorschaubild: ${title}`,
  },
  glossary: {
    title: 'Glossar',
    lettersLabel: 'Buchstaben',
    none: 'Noch keine Begriffe.',
    term: 'Begriff',
  },
  feed: {
    empty: 'Noch keine Einträge.',
    newer: 'Neuere Einträge',
    older: 'Ältere Einträge',
    pagesLabel: 'Seiten',
    pageOf: (page: number, pages: number) => `Seite ${page} von ${pages}`,
    pageTitle: (title: string, page: number) => `${title}, Seite ${page}`,
    loadFailed: 'Nachladen fehlgeschlagen. ',
  },
  live: {
    one: '1 neuer Eintrag',
    many: (count: number) => `${count} neue Einträge`,
    more: (count: number) => `${count}+ neue Einträge`,
  },
  embed: {
    frameTitle: (label: string) => `${label}: eingebetteter Inhalt`,
  },
  tags: {
    label: 'Tags',
    all: 'Alle Tags',
    none: 'Noch keine Tags.',
    title: (name: string) => `Tag ${name}`,
    heading: (name: string) => `Tag: ${name}`,
  },
};
