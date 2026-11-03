import { describe, expect, it } from 'vitest';
import {
  buildFeed,
  filterKind,
  groupByTag,
  paginate,
  pagePath,
  PAGE_SIZE,
} from './feed.ts';
import type { Article } from './articles.ts';
import type { MemoEntry } from './memos.ts';

function artikel(
  teil: Partial<Article & { html: string }> & { slug: string },
): Article & { html: string } {
  return {
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
  it('mischt Artikel und Memos, neueste zuerst', () => {
    const feed = buildFeed(
      [
        artikel({ slug: 'alt', date: new Date('2026-01-01T00:00:00Z') }),
        artikel({ slug: 'neu', date: new Date('2026-03-01T00:00:00Z') }),
      ],
      [memo({ uid: 'm1', date: new Date('2026-02-01T00:00:00Z') })],
    );
    expect(feed.map((e) => e.id)).toEqual(['post:neu', 'memo:m1', 'post:alt']);
  });

  it('vergibt URLs mit Schrägstrich am Ende', () => {
    const [post, mem] = buildFeed(
      [artikel({ slug: 'a', date: new Date('2026-02-01T00:00:00Z') })],
      [memo({ uid: 'u', date: new Date('2026-01-01T00:00:00Z') })],
    );
    expect(post?.url).toBe('/p/a/');
    expect(mem?.url).toBe('/m/u/');
  });

  it('ordnet bei gleichem Zeitpunkt stabil nach Kennung', () => {
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

  it('nimmt als Auszug die Beschreibung, sonst den Textanfang', () => {
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

  it('zeigt Memos vollständig und Artikel nur mit Auszug', () => {
    const feed = buildFeed([artikel({ slug: 'a' })], [memo({ uid: 'u' })]);
    const m = feed.find((e) => e.kind === 'memo');
    const p = feed.find((e) => e.kind === 'post');
    expect(m?.html).toBe('<p>Memo-Text</p>');
    expect(p?.html).toBeUndefined();
  });

  it('verändert die Eingaben nicht', () => {
    const arts = [
      artikel({ slug: 'b', date: new Date('2026-01-01T00:00:00Z') }),
      artikel({ slug: 'a', date: new Date('2026-02-01T00:00:00Z') }),
    ];
    buildFeed(arts, []);
    expect(arts.map((a) => a.slug)).toEqual(['b', 'a']);
  });
});

describe('filterKind', () => {
  it('filtert nach Art', () => {
    const feed = buildFeed([artikel({ slug: 'a' })], [memo({ uid: 'u' })]);
    expect(filterKind(feed, 'memo').map((e) => e.id)).toEqual(['memo:u']);
    expect(filterKind(feed, 'post').map((e) => e.id)).toEqual(['post:a']);
  });
});

describe('pagePath', () => {
  it('Seite 1 liegt an der Basis, weitere unter /seite/N/', () => {
    expect(pagePath('/', 1)).toBe('/');
    expect(pagePath('/', 2)).toBe('/seite/2/');
    expect(pagePath('/tag/x/', 1)).toBe('/tag/x/');
    expect(pagePath('/tag/x/', 3)).toBe('/tag/x/seite/3/');
  });
});

describe('paginate', () => {
  const liste = Array.from({ length: 45 }, (_, i) => i);

  it('Blockgröße ist 20', () => {
    expect(PAGE_SIZE).toBe(20);
  });

  it('teilt in Blöcke und verlinkt vor und zurück', () => {
    const erste = paginate(liste, 1, '/');
    expect(erste.items).toHaveLength(20);
    expect(erste.pages).toBe(3);
    expect(erste.prev).toBeNull();
    expect(erste.next).toBe('/seite/2/');

    const mitte = paginate(liste, 2, '/');
    expect(mitte.items[0]).toBe(20);
    expect(mitte.prev).toBe('/');
    expect(mitte.next).toBe('/seite/3/');

    const letzte = paginate(liste, 3, '/');
    expect(letzte.items).toHaveLength(5);
    expect(letzte.next).toBeNull();
    expect(letzte.prev).toBe('/seite/2/');
  });

  it('liefert für eine leere Liste genau eine leere Seite', () => {
    const leer = paginate([], 1, '/');
    expect(leer.pages).toBe(1);
    expect(leer.items).toEqual([]);
    expect(leer.next).toBeNull();
  });

  it('wirft bei ungültiger Seite', () => {
    expect(() => paginate(liste, 0, '/')).toThrow();
    expect(() => paginate(liste, 4, '/')).toThrow();
    expect(() => paginate(liste, 1.5, '/')).toThrow();
  });

  it('genau 20 Einträge ergeben eine Seite', () => {
    expect(paginate(liste.slice(0, 20), 1, '/').pages).toBe(1);
  });
});

describe('groupByTag', () => {
  it('gruppiert nach URL-Form, neueste zuerst, Tags alphabetisch', () => {
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

  it('führt Tags mit gleicher URL-Form zusammen und meldet die Namen', () => {
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

  it('zählt einen Eintrag nicht doppelt, wenn zwei Tags zusammenfallen', () => {
    const feed = buildFeed([artikel({ slug: 'a', tags: ['a/b', 'a-b'] })], []);
    const gruppen = groupByTag(feed);
    expect(gruppen[0]?.items).toHaveLength(1);
  });

  it('verwirft Tags ohne brauchbare URL-Form', () => {
    const feed = buildFeed([artikel({ slug: 'a', tags: ['???'] })], []);
    expect(groupByTag(feed)).toEqual([]);
  });
});
