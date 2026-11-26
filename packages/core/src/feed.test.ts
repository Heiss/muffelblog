import { describe, expect, it } from 'vitest';
import {
  berlinDay,
  buildFeed,
  bundleTerms,
  differentDay,
  filterKind,
  groupByTag,
  paginate,
  pagePath,
  sortFeed,
} from './feed.ts';
import { DEFAULT_SETTINGS } from './config.ts';
import type { Article } from './articles.ts';
import type { MemoEntry } from './memos.ts';

// `date` in the tests sets `created` and, unless given, `updated` too.
function artikel(
  teil: Partial<Article & { html: string }> & { slug: string; date?: Date },
): Article & { html: string } {
  const { date, ...rest } = teil;
  const created = date ?? teil.created ?? new Date('2026-01-01T00:00:00Z');
  return {
    type: 'post',
    title: teil.slug,
    created,
    createdSource: 'frontmatter',
    updated: created,
    updatedSource: 'frontmatter',
    tags: [],
    body: '',
    path: `${teil.slug}.md`,
    html: '<p>Text des Artikels</p>',
    ...rest,
  };
}

function memo(
  teil: Partial<MemoEntry> & { uid: string; date?: Date },
): MemoEntry {
  const { date, ...rest } = teil;
  const created = date ?? teil.created ?? new Date('2026-01-01T00:00:00Z');
  return {
    path: `memos/${teil.uid}`,
    title: `Memo ${teil.uid}`,
    description: 'Kurztext',
    created,
    updated: created,
    tags: [],
    html: '<p>Memo-Text</p>',
    ...rest,
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

describe('created and updated', () => {
  const day = (d: string) => new Date(`${d}T10:00:00Z`);

  it('takes both dates from articles and memos', () => {
    const feed = buildFeed(
      [
        artikel({
          slug: 'a',
          created: day('2026-01-01'),
          updated: day('2026-03-01'),
        }),
      ],
      [
        memo({
          uid: 'm',
          created: day('2026-01-02'),
          updated: day('2026-02-01'),
        }),
      ],
    );
    const byId = new Map(feed.map((i) => [i.id, i]));
    expect(byId.get('post:a')).toMatchObject({
      created: day('2026-01-01'),
      updated: day('2026-03-01'),
    });
    expect(byId.get('memo:m')).toMatchObject({
      created: day('2026-01-02'),
      updated: day('2026-02-01'),
    });
  });

  it('sorts by created in the feed and by updated on request, ties by id', () => {
    const feed = buildFeed(
      [
        artikel({
          slug: 'old-but-edited',
          created: day('2026-01-01'),
          updated: day('2026-05-01'),
        }),
        artikel({
          slug: 'new',
          created: day('2026-03-01'),
          updated: day('2026-03-01'),
        }),
        artikel({
          slug: 'same-b',
          created: day('2026-02-01'),
          updated: day('2026-04-01'),
        }),
        artikel({
          slug: 'same-a',
          created: day('2026-02-02'),
          updated: day('2026-04-01'),
        }),
      ],
      [],
    );
    expect(feed.map((i) => i.id)).toEqual([
      'post:new',
      'post:same-a',
      'post:same-b',
      'post:old-but-edited',
    ]);
    expect(sortFeed(feed, 'updated').map((i) => i.id)).toEqual([
      'post:old-but-edited',
      'post:same-a',
      'post:same-b',
      'post:new',
    ]);
    expect(sortFeed(feed, 'created')).toEqual(feed);
  });

  it('does not change the list it sorts', () => {
    const feed = buildFeed(
      [
        artikel({
          slug: 'a',
          created: day('2026-01-01'),
          updated: day('2026-05-01'),
        }),
        artikel({
          slug: 'b',
          created: day('2026-02-01'),
          updated: day('2026-02-01'),
        }),
      ],
      [],
    );
    const before = feed.map((i) => i.id);
    sortFeed(feed, 'updated');
    expect(feed.map((i) => i.id)).toEqual(before);
  });
});

describe('differentDay', () => {
  it('compares calendar days in Berlin time, not UTC', () => {
    // 22:30 UTC is 23:30 in Berlin (winter), 23:30 UTC is already the next day.
    expect(
      differentDay(
        new Date('2026-01-10T22:30:00Z'),
        new Date('2026-01-10T23:30:00Z'),
      ),
    ).toBe(true);
    expect(
      differentDay(
        new Date('2026-01-10T08:00:00Z'),
        new Date('2026-01-10T22:30:00Z'),
      ),
    ).toBe(false);
  });
});

describe('leads of posts (W24)', () => {
  it('gives posts the text up to the first heading, terms and memos none', () => {
    const feed = buildFeed(
      [
        artikel({
          slug: 'p',
          html: '<p>Intro <a href="#user-content-fn-1">1</a></p><h3>Part A</h3><p>x</p>',
        }),
        artikel({ slug: 'g', type: 'glossary', html: '<p>Term</p><h3>H</h3>' }),
      ],
      [memo({ uid: 'm' })],
    );
    const byId = new Map(feed.map((i) => [i.id, i]));
    expect(byId.get('post:p')?.lead).toEqual({
      html: '<p>Intro <a href="/p/p/#user-content-fn-1">1</a></p>',
      next: 'Part A',
    });
    expect(byId.get('glossary:g')).not.toHaveProperty('lead');
    expect(byId.get('memo:m')).not.toHaveProperty('lead');
  });
});

describe('berlinDay', () => {
  it('is the calendar day in Berlin time', () => {
    expect(berlinDay(new Date('2026-11-13T22:59:59Z'))).toBe('2026-11-13');
    expect(berlinDay(new Date('2026-11-13T23:00:00Z'))).toBe('2026-11-14');
    expect(berlinDay(new Date('2026-07-01T21:59:59Z'))).toBe('2026-07-01');
    expect(berlinDay(new Date('2026-07-01T22:00:00Z'))).toBe('2026-07-02');
  });
});

describe('bundleTerms (W24, O44)', () => {
  const day = (iso: string) => new Date(iso);
  const feed = buildFeed(
    [
      artikel({ slug: 'post', date: day('2026-11-17T11:00:00Z') }),
      artikel({
        slug: 'a',
        type: 'glossary',
        date: day('2026-11-13T12:00:00Z'),
      }),
      artikel({
        slug: 'b',
        type: 'glossary',
        date: day('2026-11-13T11:00:00Z'),
      }),
      artikel({
        slug: 'lone',
        type: 'glossary',
        date: day('2026-11-10T11:00:00Z'),
      }),
      artikel({
        slug: 'c',
        type: 'glossary',
        date: day('2026-11-13T09:00:00Z'),
        updated: day('2026-11-20T09:00:00Z'),
      }),
    ],
    [memo({ uid: 'm', date: day('2026-11-13T10:00:00Z') })],
  );

  it('puts all terms of a day into one bundle at the place of the first, keeps the rest', () => {
    const rows = bundleTerms(feed);
    expect(rows.map((r) => r.id)).toEqual([
      'post:post',
      'bundle:2026-11-13',
      'memo:m',
      'glossary:lone',
    ]);
    const bundle = rows[1];
    expect(bundle).toEqual({
      kind: 'bundle',
      id: 'bundle:2026-11-13',
      day: '2026-11-13',
      created: day('2026-11-13T12:00:00Z'),
      updated: day('2026-11-20T09:00:00Z'),
      terms: feed.filter((i) =>
        ['glossary:a', 'glossary:b', 'glossary:c'].includes(i.id),
      ),
    });
  });

  it('keeps a day with a single term as a normal entry', () => {
    const rows = bundleTerms(
      feed.filter((i) => i.id !== 'glossary:b' && i.id !== 'glossary:c'),
    );
    expect(rows.map((r) => r.id)).toEqual([
      'post:post',
      'glossary:a',
      'memo:m',
      'glossary:lone',
    ]);
  });

  it('groups by the day of the date the list is sorted by', () => {
    const rows = bundleTerms(sortFeed(feed, 'updated'), 'updated');
    expect(rows.map((r) => r.id)).toEqual([
      'glossary:c',
      'post:post',
      'bundle:2026-11-13',
      'memo:m',
      'glossary:lone',
    ]);
    const bundle = rows.find((r) => r.kind === 'bundle');
    expect(bundle?.kind === 'bundle' && bundle.terms.map((t) => t.id)).toEqual([
      'glossary:a',
      'glossary:b',
    ]);
  });

  it('defaults to the creation date and leaves an empty list empty', () => {
    expect(bundleTerms(feed).map((r) => r.id)).toEqual(
      bundleTerms(feed, 'created').map((r) => r.id),
    );
    expect(bundleTerms([])).toEqual([]);
  });
});
