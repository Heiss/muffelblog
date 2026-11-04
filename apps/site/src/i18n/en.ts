import type { Messages } from './types.ts';

/** English UI texts. The shape of this object defines the type `Messages`. */
export const en = {
  /** Value of `<html lang>` and of the locale of the comments widget. */
  lang: 'en',
  /** Locale for dates and numbers. */
  locale: 'en-GB',
  nav: {
    label: 'Main navigation',
    home: 'Home',
    tags: 'Tags',
    glossary: 'Glossary',
    search: 'Search',
  },
  search: {
    title: 'Search',
    placeholder: 'Search …',
    kind: 'Type',
    tag: 'Tag',
    needsJs: 'Search needs JavaScript.',
    unavailable:
      'The search index is not available. It is created during the build.',
    summary: {
      none: 'No results for “{term}”.',
      one: '1 result for “{term}”.',
      many: '{count} results for “{term}”.',
    },
    all: 'All',
  },
  comments: {
    title: 'Comments',
    needsJs: 'Comments need JavaScript.',
    unavailable: 'The comments could not be loaded.',
    deleted: 'This comment was deleted.',
  },
  footer: {
    label: 'Footer',
    rss: 'RSS',
    glossary: 'Glossary',
  },
  notFound: {
    title: 'Page not found',
    text: 'This page does not exist (any more).',
    home: 'Back to the home page',
  },
  rss: {
    description: 'Posts, short notes and terms',
  },
  theme: {
    label: 'Color scheme',
    /** Names that differ from the label of the theme (by theme id). */
    names: {} as Record<string, string>,
  },
  filter: {
    label: 'Filter',
    all: 'All',
    long: 'Long',
    short: 'Short',
    terms: 'Terms',
  },
  glossary: {
    title: 'Glossary',
    lettersLabel: 'Letters',
    none: 'No terms yet.',
    term: 'Term',
  },
  feed: {
    empty: 'No entries yet.',
    newer: 'Newer entries',
    older: 'Older entries',
    pagesLabel: 'Pages',
    pageOf: (page: number, pages: number) => `Page ${page} of ${pages}`,
    pageTitle: (title: string, page: number) => `${title}, page ${page}`,
    loadFailed: 'Loading more failed. ',
  },
  embed: {
    frameTitle: (label: string) => `${label}: embedded content`,
  },
  tags: {
    label: 'Tags',
    all: 'All tags',
    none: 'No tags yet.',
    title: (name: string) => `Tag ${name}`,
    heading: (name: string) => `Tag: ${name}`,
  },
} as const;

// Compile-time check that `Messages` (derived from this object) is what `en` is.
export const _en: Messages = en;
