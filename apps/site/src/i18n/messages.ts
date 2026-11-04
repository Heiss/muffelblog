/**
 * All texts of the user interface. Today there is one language (German); the
 * UI language per `MUFFEL_LANG` (de, en) is added in W23, then this object
 * becomes one catalog per language with a shared type.
 */
export const messages = {
  /** Locale for dates and numbers. */
  locale: 'de-DE',
  nav: {
    label: 'Hauptnavigation',
    home: 'Start',
    tags: 'Tags',
    glossary: 'Glossar',
    search: 'Suche',
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
  },
  filter: {
    label: 'Filter',
    all: 'Alle',
    long: 'Lang',
    short: 'Kurz',
    terms: 'Begriffe',
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
} as const;
