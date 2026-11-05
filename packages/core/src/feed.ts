import type { Article } from './articles.ts';
import { DEFAULT_SETTINGS } from './config.ts';
import { plainExcerpt } from './excerpt.ts';
import type { MemoEntry } from './memos.ts';
import { tagSlug } from './slug.ts';

export type FeedKind = 'post' | 'memo' | 'glossary';

export interface FeedItem {
  kind: FeedKind;
  /** Unique across both kinds: `post:<slug>`, `glossary:<slug>` or `memo:<uid>`. */
  id: string;
  url: string;
  title: string;
  date: Date;
  tags: string[];
  /** Plain text: description, otherwise the start of the text. */
  excerpt: string;
  /** Memos only: complete, sanitized HTML. */
  html?: string;
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
      .map((a): FeedItem => ({
        kind: a.type === 'glossary' ? 'glossary' : 'post',
        id: `${a.type}:${a.slug}`,
        url: a.type === 'glossary' ? `/g/${a.slug}/` : `/p/${a.slug}/`,
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
