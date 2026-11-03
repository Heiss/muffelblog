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
  },
  theme: {
    label: 'Farbschema',
  },
  filter: {
    label: 'Filter',
    all: 'Alle',
    long: 'Lang',
    short: 'Kurz',
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
