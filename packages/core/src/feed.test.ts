import { describe, expect, it } from 'vitest';
import {
  buildFeed,
  filterKind,
  groupByTag,
  paginate,
  pagePath,
} from './feed.ts';
import { DEFAULT_SETTINGS } from './config.ts';
import type { Article } from './articles.ts';
import type { MemoEntry } from './memos.ts';

function artikel(
  teil: Partial<Article & { html: string }> & { slug: string },
): Article & { html: string } {
  return {
    type: 'post',
    title: teil.slug,
    date: new Date('2026-01-01T00:00:00Z'),
    dateSource: 'frontmatter',
    tags: [],
    body: '',
    path: `${teil.slug}.md`,
    html: '<p>Text des Artikels</p>',
    ...teil,
  };
}

function memo(teil: Partial<MemoEntry> & { uid: string }): MemoEntry {
  return {
    path: `memos/${teil.uid}`,
    title: `Memo ${teil.uid}`,
    description: 'Kurztext',
    date: new Date('2026-01-01T00:00:00Z'),
    tags: [],
    html: '<p>Memo-Text</p>',
    ...teil,
  };
}

describe('buildFeed', () => {
  it('mixes articles and memos, newest first', () => {
    const feed = buildFeed(
      [
        artikel({ slug: 'alt', date: new Date('2026-01-01T00:00:00Z') }),
        artikel({ slug: 'neu', date: new Date('2026-03-01T00:00:00Z') }),
      ],
      [memo({ uid: 'm1', date: new Date('2026-02-01T00:00:00Z') })],
    );
    expect(feed.map((e) => e.id)).toEqual(['post:neu', 'memo:m1', 'post:alt']);
  });

  it('assigns URLs with a trailing slash', () => {
    const [post, mem] = buildFeed(
      [artikel({ slug: 'a', date: new Date('2026-02-01T00:00:00Z') })],
      [memo({ uid: 'u', date: new Date('2026-01-01T00:00:00Z') })],
    );
    expect(post?.url).toBe('/p/a/');
    expect(mem?.url).toBe('/m/u/');
  });

  it('orders stably by identifier at the same instant', () => {
    const d = new Date('2026-01-01T00:00:00Z');
    const a = buildFeed(
      [artikel({ slug: 'b', date: d }), artikel({ slug: 'a', date: d })],
      [memo({ uid: 'x', date: d })],
    );
    const b = buildFeed(
      [artikel({ slug: 'a', date: d })],
      [memo({ uid: 'x', date: d }), ...[]],
    );
    expect(a.map((e) => e.id)).toEqual(['memo:x', 'post:a', 'post:b']);
    expect(b.map((e) => e.id)).toEqual(['memo:x', 'post:a']);
  });

  it('uses the description as the excerpt, otherwise the start of the text', () => {
    const [mit, ohne] = buildFeed(
      [
        artikel({
          slug: 'mit',
          description: 'Meine Beschreibung',
          date: new Date('2026-02-01T00:00:00Z'),
        }),
        artikel({ slug: 'ohne', html: '<h2>Titel</h2><p>Los geht es</p>' }),
      ],
      [],
    );
    expect(mit?.excerpt).toBe('Meine Beschreibung');
    expect(ohne?.excerpt).toBe('Titel Los geht es');
  });

  it('cuts the start of the text to the configured length', () => {
    const [entry] = buildFeed(
      [artikel({ slug: 'a', html: `<p>${'wort '.repeat(50)}</p>` })],
      [],
      { excerptChars: 30 },
    );
    expect(entry?.excerpt.length).toBeLessThanOrEqual(30);
    expect(entry?.excerpt.endsWith('…')).toBe(true);
  });

  it('shows memos in full and articles only with an excerpt', () => {
    const feed = buildFeed([artikel({ slug: 'a' })], [memo({ uid: 'u' })]);
    const m = feed.find((e) => e.kind === 'memo');
    const p = feed.find((e) => e.kind === 'post');
    expect(m?.html).toBe('<p>Memo-Text</p>');
    expect(p?.html).toBeUndefined();
  });

  it('does not change the inputs', () => {
    const arts = [
      artikel({ slug: 'b', date: new Date('2026-01-01T00:00:00Z') }),
      artikel({ slug: 'a', date: new Date('2026-02-01T00:00:00Z') }),
    ];
    buildFeed(arts, []);
    expect(arts.map((a) => a.slug)).toEqual(['b', 'a']);
  });
});

describe('glossary in the feed', () => {
  it('builds a glossary item with /g/ URL, its own id and the description', () => {
    const feed = buildFeed(
      [
        artikel({
          slug: 'cache',
          type: 'glossary',
          description: 'Zwischenspeicher',
        }),
      ],
      [],
    );
    expect(feed[0]).toMatchObject({
      kind: 'glossary',
      id: 'glossary:cache',
      url: '/g/cache/',
      excerpt: 'Zwischenspeicher',
    });
  });

  it('keeps a post and a term with the same slug apart', () => {
    const feed = buildFeed(
      [artikel({ slug: 'x' }), artikel({ slug: 'x', type: 'glossary' })],
      [],
    );
    expect(feed.map((i) => i.id).sort()).toEqual(['glossary:x', 'post:x']);
  });

  it('never puts terms into the post filter', () => {
    const feed = buildFeed(
      [artikel({ slug: 'x' }), artikel({ slug: 'y', type: 'glossary' })],
      [],
    );
    expect(filterKind(feed, 'post').map((i) => i.id)).toEqual(['post:x']);
    expect(filterKind(feed, 'glossary').map((i) => i.id)).toEqual([
      'glossary:y',
    ]);
  });
});

describe('pages in the feed', () => {
  it('never puts static pages into the feed', () => {
    const feed = buildFeed(
      [artikel({ slug: 'impressum', type: 'page' }), artikel({ slug: 'x' })],
      [],
    );
    expect(feed.map((i) => i.id)).toEqual(['post:x']);
  });
});

describe('filterKind', () => {
  it('filters by kind', () => {
    const feed = buildFeed([artikel({ slug: 'a' })], [memo({ uid: 'u' })]);
    expect(filterKind(feed, 'memo').map((e) => e.id)).toEqual(['memo:u']);
    expect(filterKind(feed, 'post').map((e) => e.id)).toEqual(['post:a']);
  });
});

describe('pagePath', () => {
  it('page 1 lives at the base, further pages under /page/N/', () => {
    expect(pagePath('/', 1)).toBe('/');
    expect(pagePath('/', 2)).toBe('/page/2/');
    expect(pagePath('/tag/x/', 1)).toBe('/tag/x/');
    expect(pagePath('/tag/x/', 3)).toBe('/tag/x/page/3/');
  });
});

describe('paginate', () => {
  const list = Array.from({ length: 45 }, (_, i) => i);

  it('block size is 20', () => {
    expect(DEFAULT_SETTINGS.feedPageSize).toBe(20);
  });

  it('splits into blocks and links back and forth', () => {
    const erste = paginate(list, 1, '/');
    expect(erste.items).toHaveLength(20);
    expect(erste.pages).toBe(3);
    expect(erste.prev).toBeNull();
    expect(erste.next).toBe('/page/2/');

    const mitte = paginate(list, 2, '/');
    expect(mitte.items[0]).toBe(20);
    expect(mitte.prev).toBe('/');
    expect(mitte.next).toBe('/page/3/');

    const letzte = paginate(list, 3, '/');
    expect(letzte.items).toHaveLength(5);
    expect(letzte.next).toBeNull();
    expect(letzte.prev).toBe('/page/2/');
  });

  it('returns exactly one empty page for an empty list', () => {
    const leer = paginate([], 1, '/');
    expect(leer.pages).toBe(1);
    expect(leer.items).toEqual([]);
    expect(leer.next).toBeNull();
  });

  it('throws for an invalid page', () => {
    expect(() => paginate(list, 0, '/')).toThrow();
    expect(() => paginate(list, 4, '/')).toThrow();
    expect(() => paginate(list, 1.5, '/')).toThrow();
  });

  it('exactly 20 entries make one page', () => {
    expect(paginate(list.slice(0, 20), 1, '/').pages).toBe(1);
  });
});

describe('groupByTag', () => {
  it('groups by URL form, newest first, tags alphabetical', () => {
    const feed = buildFeed(
      [
        artikel({
          slug: 'a',
          tags: ['rust', 'web'],
          date: new Date('2026-01-01T00:00:00Z'),
        }),
        artikel({
          slug: 'b',
          tags: ['rust'],
          date: new Date('2026-02-01T00:00:00Z'),
        }),
      ],
      [memo({ uid: 'm', tags: ['web'] })],
    );
    const gruppen = groupByTag(feed);
    expect(gruppen.map((g) => g.slug)).toEqual(['rust', 'web']);
    expect(gruppen[0]?.items.map((e) => e.id)).toEqual(['post:b', 'post:a']);
    expect(gruppen[0]?.count).toBe(2);
  });

  it('merges tags with the same URL form and reports the names', () => {
    const feed = buildFeed(
      [
        artikel({ slug: 'a', tags: ['a/b'] }),
        artikel({ slug: 'b', tags: ['a-b'] }),
      ],
      [],
    );
    const gruppen = groupByTag(feed);
    expect(gruppen).toHaveLength(1);
    expect(gruppen[0]?.slug).toBe('a-b');
    expect(gruppen[0]?.names).toEqual(['a-b', 'a/b']);
    expect(gruppen[0]?.items).toHaveLength(2);
  });

  it('does not count an entry twice if two tags collapse', () => {
    const feed = buildFeed([artikel({ slug: 'a', tags: ['a/b', 'a-b'] })], []);
    const gruppen = groupByTag(feed);
    expect(gruppen[0]?.items).toHaveLength(1);
  });

  it('drops tags without a usable URL form', () => {
    const feed = buildFeed([artikel({ slug: 'a', tags: ['???'] })], []);
    expect(groupByTag(feed)).toEqual([]);
  });
});
