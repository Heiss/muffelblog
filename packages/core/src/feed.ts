import type { Article } from './articles.ts';
import { DEFAULT_SETTINGS } from './config.ts';
import { plainExcerpt } from './excerpt.ts';
import type { MemoEntry } from './memos.ts';
import { tagSlug } from './slug.ts';

export type FeedKind = 'post' | 'memo';

export interface FeedItem {
  kind: FeedKind;
  /** Eindeutig über beide Arten: `post:<slug>` oder `memo:<uid>`. */
  id: string;
  url: string;
  title: string;
  date: Date;
  tags: string[];
  /** Klartext: Beschreibung, sonst Textanfang. */
  excerpt: string;
  /** Nur bei Memos: vollständiges, bereinigtes HTML. */
  html?: string;
}

export function buildFeed(
  articles: ReadonlyArray<Article & { html: string }>,
  memos: ReadonlyArray<MemoEntry>,
  optionen: { excerptChars?: number } = {},
): FeedItem[] {
  const auszugMax = optionen.excerptChars ?? DEFAULT_SETTINGS.feedExcerptChars;
  const items: FeedItem[] = [
    ...articles.map((a): FeedItem => ({
      kind: 'post',
      id: `post:${a.slug}`,
      url: `/p/${a.slug}/`,
      title: a.title,
      date: a.date,
      tags: a.tags,
      excerpt: a.description?.trim() || plainExcerpt(a.html, auszugMax),
    })),
    ...memos.map((m): FeedItem => ({
      kind: 'memo',
      id: `memo:${m.uid}`,
      url: `/m/${m.uid}/`,
      title: m.title,
      date: m.date,
      tags: m.tags,
      excerpt: m.description,
      html: m.html,
    })),
  ];
  return items.sort(
    (a, b) =>
      b.date.getTime() - a.date.getTime() ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

export function filterKind(items: FeedItem[], kind: FeedKind): FeedItem[] {
  return items.filter((e) => e.kind === kind);
}

/** Pfad einer Seite: Seite 1 liegt an der Basis, weitere unter `<basis>seite/N/`. */
export function pagePath(base: string, page: number): string {
  return page === 1 ? base : `${base}seite/${page}/`;
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
    throw new RangeError(`Seite ${page} existiert nicht (1 bis ${pages})`);
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
  /** URL-Form, Teil von `/tag/<slug>/`. */
  slug: string;
  /** Alle Schreibweisen, die auf diese URL-Form fallen, sortiert. */
  names: string[];
  count: number;
  items: FeedItem[];
}

/** Gruppiert nach URL-Form des Tags. Reihenfolge der Einträge bleibt erhalten. */
export function groupByTag(feed: FeedItem[]): TagGroup[] {
  const gruppen = new Map<string, { names: Set<string>; items: FeedItem[] }>();
  for (const eintrag of feed) {
    const gesehen = new Set<string>();
    for (const tag of eintrag.tags) {
      const slug = tagSlug(tag);
      if (!slug) continue;
      let gruppe = gruppen.get(slug);
      if (!gruppe) {
        gruppe = { names: new Set(), items: [] };
        gruppen.set(slug, gruppe);
      }
      gruppe.names.add(tag);
      if (!gesehen.has(slug)) {
        gesehen.add(slug);
        gruppe.items.push(eintrag);
      }
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
