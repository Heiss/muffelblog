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
    graph: 'Graph',
    comments: 'Comments',
    more: 'More',
    files: 'Files',
    search: 'Search',
    menu: 'Menu',
    close: 'Close',
    quick: 'Quick navigation',
    skip: 'Skip to the content',
    counts: (posts: number, memos: number, terms: number) =>
      `${posts} ${posts === 1 ? 'post' : 'posts'} · ${memos} ${memos === 1 ? 'memo' : 'memos'} · ${terms} ${terms === 1 ? 'term' : 'terms'}`,
  },
  files: {
    title: 'Files',
    intro:
      'All published posts, terms and pages, in the folders where they are written.',
    none: 'No files yet.',
    openAll: 'Open all folders',
    closeAll: 'Close all folders',
    controls: 'Folders',
    count: (count: number) => (count === 1 ? '1 file' : `${count} files`),
  },
  graph: {
    title: 'Graph',
    intro:
      'How posts, terms and memos link to each other and to other websites. Each other website is one point.',
    linksTo: 'Links to',
    linkedFrom: 'Linked from',
    local: 'Links of this page',
    needsJs:
      'The drawing needs JavaScript; the lists of links work without it.',
    empty: 'No links yet.',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    zoomReset: 'Show everything',
    arrange: 'Arrange again',
    zoomHint:
      'Mouse wheel zooms, drag the background to move, drag a point to move it.',
    find: 'Find a point',
    show: 'Show',
    focus: 'Focus',
    neighbours: 'Neighbours',
    showAll: 'Show the whole graph',
    showFocus: 'Back to the focus',
    kinds: {
      post: 'Post',
      glossary: 'Term',
      memo: 'Memo',
      domain: 'Website',
    },
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
  recentComments: {
    title: 'New comments',
    intro: 'The latest comments on all posts, memos and terms, newest first.',
    none: 'No comments yet.',
    on: 'on',
    replyTo: (author: string) => `Reply to ${author}`,
    replyToGone: 'Reply to a comment that is gone',
    jump: 'Go to the comment',
    label: 'Comments',
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
  sort: {
    label: 'Sort by',
    created: 'Created',
    updated: 'Updated',
    updatedOn: (date: string) => `Updated: ${date}`,
  },
  og: {
    post: 'Post',
    memo: 'Memo',
    term: 'Term',
    alt: (title: string) => `Preview image: ${title}`,
  },
  glossary: {
    title: 'Glossary',
    lettersLabel: 'Letters',
    none: 'No terms yet.',
    term: 'Term',
    filter: 'Filter terms',
    count: (count: number) => (count === 1 ? '1 term' : `${count} terms`),
  },
  feed: {
    empty: 'No entries yet.',
    newer: 'Newer entries',
    older: 'Older entries',
    pagesLabel: 'Pages',
    pageOf: (page: number, pages: number) => `Page ${page} of ${pages}`,
    pageTitle: (title: string, page: number) => `${title}, page ${page}`,
    loadFailed: 'Loading more failed. ',
    continueWith: (heading: string) => `Continue with “${heading}”`,
    read: 'Read on',
    newTerms: (count: number) => `${count} new terms:`,
    showAllTerms: (count: number) => `Show all ${count}`,
  },
  page: {
    contents: 'Contents',
    more: 'More on this page',
    links: (count: number) => (count === 1 ? '1 link' : `${count} links`),
    related: (tag: string) => `More with #${tag}`,
    relatedCount: (count: number) =>
      count === 1 ? '1 memo' : `${count} memos`,
    showAll: (count: number) => `Show all ${count}`,
  },
  live: {
    one: '1 new entry',
    many: (count: number) => `${count} new entries`,
    more: (count: number) => `${count}+ new entries`,
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
    view: 'View',
    cloud: 'Cloud',
    list: 'List',
    count: (count: number) => (count === 1 ? '1 tag' : `${count} tags`),
  },
} as const;

// Compile-time check that `Messages` (derived from this object) is what `en` is.
export const _en: Messages = en;
