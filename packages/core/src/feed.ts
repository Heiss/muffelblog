import type { Article } from './articles.ts';
import { DEFAULT_SETTINGS } from './config.ts';
import { plainExcerpt } from './excerpt.ts';
import { leadOf } from './html-parts.ts';
import type { Lead } from './html-parts.ts';
import type { MemoEntry } from './memos.ts';
import { tagSlug } from './slug.ts';

export type FeedKind = 'post' | 'memo' | 'glossary';

export interface FeedItem {
  kind: FeedKind;
  /** Unique across both kinds: `post:<slug>`, `glossary:<slug>` or `memo:<uid>`. */
  id: string;
  url: string;
  title: string;
  created: Date;
  updated: Date;
  tags: string[];
  /** Plain text: description, otherwise the start of the text. */
  excerpt: string;
  /** Memos only: complete, sanitized HTML. */
  html?: string;
  /** Posts only: the text up to the first heading (layout W24). */
  lead?: Lead;
}

export function buildFeed(
  articles: ReadonlyArray<Article & { html: string }>,
  memos: ReadonlyArray<MemoEntry>,
  optionen: { excerptChars?: number } = {},
): FeedItem[] {
  const auszugMax = optionen.excerptChars ?? DEFAULT_SETTINGS.feedExcerptChars;
  const items: FeedItem[] = [
    ...articles
      .filter((a) => a.type !== 'page')
      .map((a): FeedItem => {
        const url = a.type === 'glossary' ? `/g/${a.slug}/` : `/p/${a.slug}/`;
        return {
          kind: a.type === 'glossary' ? 'glossary' : 'post',
          id: `${a.type}:${a.slug}`,
          url,
          title: a.title,
          created: a.created,
          updated: a.updated,
          tags: a.tags,
          excerpt: a.description?.trim() || plainExcerpt(a.html, auszugMax),
          ...(a.type === 'post' ? { lead: leadOf(a.html, url) } : {}),
        };
      }),
    ...memos.map((m): FeedItem => ({
      kind: 'memo',
      id: `memo:${m.uid}`,
      url: `/m/${m.uid}/`,
      title: m.title,
      created: m.created,
      updated: m.updated,
      tags: m.tags,
      excerpt: m.description,
      html: m.html,
    })),
  ];
  return sortFeed(items, 'created');
}

/** Which date the feed is sorted by. */
export type FeedSort = 'created' | 'updated';

/** A sorted copy, newest first; on a tie the id decides. */
export function sortFeed(
  items: readonly FeedItem[],
  sort: FeedSort,
): FeedItem[] {
  return [...items].sort(
    (a, b) =>
      b[sort].getTime() - a[sort].getTime() ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

const BERLIN_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
});

/** The calendar day of an instant in Berlin time, as `YYYY-MM-DD`. */
export function berlinDay(date: Date): string {
  return BERLIN_DAY.format(date);
}

/**
 * True when the two instants fall on different calendar days in Berlin time.
 * Used to show "updated" only when it adds information.
 */
export function differentDay(a: Date, b: Date): boolean {
  return berlinDay(a) !== berlinDay(b);
}

/** All terms of one day as one entry of the feed (layout W24, O44). */
export interface TermBundle {
  kind: 'bundle';
  /** `bundle:<YYYY-MM-DD>`, the day in Berlin time. */
  id: string;
  day: string;
  /** The newest creation and change of its terms. */
  created: Date;
  updated: Date;
  /** The terms, in the order of the feed. */
  terms: FeedItem[];
}

/** One row of a list: an entry, or a bundle of terms. */
export type FeedRow = FeedItem | TermBundle;

function newest(items: readonly FeedItem[], key: FeedSort): Date {
  return new Date(Math.max(...items.map((i) => i[key].getTime())));
}

function termsByDay(
  items: readonly FeedItem[],
  sort: FeedSort,
): Map<string, FeedItem[]> {
  const days = new Map<string, FeedItem[]>();
  for (const item of items) {
    if (item.kind !== 'glossary') continue;
    const day = berlinDay(item[sort]);
    days.set(day, [...(days.get(day) ?? []), item]);
  }
  return days;
}

/**
 * The terms of one day (by the date the list is sorted by) become one bundle
 * at the place of the first of them; a day with a single term keeps it as it
 * is. Posts and memos stay where they are.
 */
export function bundleTerms(
  items: readonly FeedItem[],
  sort: FeedSort = 'created',
): FeedRow[] {
  const days = termsByDay(items, sort);
  const placed = new Set<string>();
  const rows: FeedRow[] = [];
  for (const item of items) {
    const day = berlinDay(item[sort]);
    const terms = item.kind === 'glossary' ? (days.get(day) ?? []) : [];
    if (terms.length < 2) rows.push(item);
    else if (!placed.has(day)) {
      placed.add(day);
      rows.push({
        kind: 'bundle',
        id: `bundle:${day}`,
        day,
        created: newest(terms, 'created'),
        updated: newest(terms, 'updated'),
        terms,
      });
    }
  }
  return rows;
}

export function filterKind(items: FeedItem[], kind: FeedKind): FeedItem[] {
  return items.filter((e) => e.kind === kind);
}

/** Path of a page: page 1 lives at the base, further pages under `<base>page/N/`. */
export function pagePath(base: string, page: number): string {
  return page === 1 ? base : `${base}page/${page}/`;
}

export interface Page<T> {
  items: T[];
  page: number;
  pages: number;
  prev: string | null;
  next: string | null;
}

export function paginate<T>(
  items: readonly T[],
  page: number,
  base: string,
  size = DEFAULT_SETTINGS.feedPageSize,
): Page<T> {
  const pages = Math.max(1, Math.ceil(items.length / size));
  if (!Number.isInteger(page) || page < 1 || page > pages) {
    throw new RangeError(`Page ${page} does not exist (1 to ${pages})`);
  }
  return {
    items: items.slice((page - 1) * size, page * size),
    page,
    pages,
    prev: page > 1 ? pagePath(base, page - 1) : null,
    next: page < pages ? pagePath(base, page + 1) : null,
  };
}

export interface TagGroup {
  /** URL form, part of `/tag/<slug>/`. */
  slug: string;
  /** All spellings that map to this URL form, sorted. */
  names: string[];
  count: number;
  items: FeedItem[];
}

/** Groups by the URL form of the tag. The order of the entries is kept. */
export function groupByTag(feed: FeedItem[]): TagGroup[] {
  const gruppen = new Map<string, { names: Set<string>; items: FeedItem[] }>();
  const groupOf = (slug: string) => {
    const existing = gruppen.get(slug);
    if (existing) return existing;
    const created = { names: new Set<string>(), items: [] as FeedItem[] };
    gruppen.set(slug, created);
    return created;
  };
  for (const eintrag of feed) {
    const gesehen = new Set<string>();
    for (const tag of eintrag.tags) {
      const slug = tagSlug(tag);
      if (!slug) continue;
      const gruppe = groupOf(slug);
      gruppe.names.add(tag);
      // An entry appears once per group, even with two spellings of the tag.
      if (!gesehen.has(slug)) gruppe.items.push(eintrag);
      gesehen.add(slug);
    }
  }
  return [...gruppen.entries()]
    .map(([slug, g]) => ({
      slug,
      names: [...g.names].sort(),
      count: g.items.length,
      items: g.items,
    }))
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}
