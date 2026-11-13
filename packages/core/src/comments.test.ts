import { describe, expect, it } from 'vitest';
import {
  commentsFingerprint,
  forPage,
  parseComments,
  recentComments,
  toTree,
} from './comments.ts';
import type { RemarkComment } from './comments.ts';

const c = (over: Partial<RemarkComment> & { id: string }): RemarkComment => ({
  text: '<p>Hallo</p>',
  user: { name: 'Anna' },
  time: '2026-11-04T10:00:00Z',
  locator: { url: 'https://blog.example/p/x/' },
  ...over,
});

describe('parseComments', () => {
  it('accepts a list and an object with comments', () => {
    const raw = [
      {
        id: 'a',
        text: 't',
        user: { name: 'N' },
        time: '2026-11-04T10:00:00Z',
        locator: { url: 'u' },
      },
    ];
    expect(parseComments(raw).comments).toHaveLength(1);
    expect(parseComments({ comments: raw, info: {} }).comments).toHaveLength(1);
  });

  it('accepts null comments as an empty list (Remark42 answers that for a page without comments)', () => {
    expect(parseComments({ comments: null }).comments).toEqual([]);
  });

  it('rejects an answer that is not comments at all', () => {
    expect(() => parseComments('nope')).toThrow(/unexpected/i);
    expect(() => parseComments({ error: 'x' })).toThrow(/unexpected/i);
  });

  it('skips a broken entry with a warning and keeps the others', () => {
    const good = {
      id: 'a',
      text: 't',
      user: { name: 'N' },
      time: '2026-11-04T10:00:00Z',
      locator: { url: 'u' },
    };
    const r = parseComments([
      good,
      { id: 'b' },
      42,
      { ...good, id: 'c', time: 'not a date' },
    ]);
    expect(r.comments.map((x) => x.id)).toEqual(['a']);
    expect(r.warnings).toHaveLength(3);
  });
});

describe('toTree', () => {
  it('orders roots and replies by time and nests replies', async () => {
    const tree = await toTree([
      c({ id: 'r2', time: '2026-11-04T12:00:00Z' }),
      c({ id: 'r1', time: '2026-11-04T10:00:00Z' }),
      c({ id: 'a', pid: 'r1', time: '2026-11-04T11:00:00Z' }),
    ]);
    expect(tree.map((n) => n.id)).toEqual(['r1', 'r2']);
    expect(tree[0]?.replies.map((n) => n.id)).toEqual(['a']);
  });

  it('shows the author as text and the time as ISO string', async () => {
    const [n] = await toTree([c({ id: 'a', user: { name: '<b>Evil</b>' } })]);
    expect(n?.author).toBe('<b>Evil</b>');
    expect(n?.time).toBe('2026-11-04T10:00:00.000Z');
  });

  it('sanitizes the text of a comment (even though Remark42 does it too)', async () => {
    const [n] = await toTree([
      c({
        id: 'a',
        text: '<p>ok</p><script>alert(1)</script><img src="https://evil.example/x.png" onerror="x()"><a href="javascript:alert(1)">l</a><a href="https://example.org/">m</a>',
      }),
    ]);
    expect(n?.html).toContain('ok');
    expect(n?.html).not.toContain('script');
    expect(n?.html).not.toContain('<img');
    expect(n?.html).not.toContain('javascript:');
    expect(n?.html).toContain('rel="noopener noreferrer"');
  });

  it('drops deleted comments without replies and keeps a placeholder with replies', async () => {
    const tree = await toTree([
      c({ id: 'gone', delete: true, text: '' }),
      c({ id: 'parent', delete: true, text: 'secret' }),
      c({ id: 'child', pid: 'parent' }),
    ]);
    expect(tree.map((n) => n.id)).toEqual(['parent']);
    expect(tree[0]).toMatchObject({ deleted: true, html: '' });
    expect(tree[0]?.replies.map((n) => n.id)).toEqual(['child']);
  });

  it('promotes a reply whose parent is missing and survives loops', async () => {
    const tree = await toTree([
      c({ id: 'orphan', pid: 'nowhere' }),
      c({ id: 'x', pid: 'y' }),
      c({ id: 'y', pid: 'x' }),
    ]);
    const ids = tree.map((n) => n.id).sort();
    expect(ids).toContain('orphan');
    // Nothing is lost and nothing loops forever.
    const count = (nodes: typeof tree): number =>
      nodes.reduce((s, n) => s + 1 + count(n.replies), 0);
    expect(count(tree)).toBe(3);
  });
});

describe('commentsFingerprint', () => {
  it('changes with new, edited, deleted comments and not with the order', () => {
    const a = c({ id: 'a' });
    const b = c({ id: 'b', text: '<p>zwei</p>' });
    const base = commentsFingerprint([a, b]);
    expect(commentsFingerprint([b, a])).toBe(base);
    expect(commentsFingerprint([a])).not.toBe(base);
    expect(
      commentsFingerprint([a, { ...b, text: '<p>geändert</p>' }]),
    ).not.toBe(base);
    expect(commentsFingerprint([a, { ...b, delete: true }])).not.toBe(base);
  });
});

describe('forPage', () => {
  const a = c({ id: 'a', locator: { url: 'https://blog.example/p/x/' } });
  const b = c({ id: 'b', locator: { url: 'https://blog.example/p/y/' } });
  const d = c({ id: 'd', locator: { url: '/p/x/' } });

  it('picks the comments of one page by its address', () => {
    expect(
      forPage([a, b], 'https://blog.example/p/x/').map((x) => x.id),
    ).toEqual(['a']);
  });

  it('ignores differences in how the same address is written', () => {
    const odd = c({
      id: 'o',
      locator: { url: 'HTTPS://Blog.Example:443/p/x/' },
    });
    expect(
      forPage([odd], 'https://blog.example/p/x/').map((x) => x.id),
    ).toEqual(['o']);
  });

  it('matches by path when the key is only a path (fixtures)', () => {
    expect(
      forPage([a, d], '/p/x/')
        .map((x) => x.id)
        .sort(),
    ).toEqual(['a', 'd']);
  });

  it('finds nothing for an unknown page', () => {
    expect(forPage([a, b], 'https://blog.example/p/none/')).toEqual([]);
  });
});

describe('recentComments', () => {
  const pages: Record<string, { url: string; title: string }> = {
    'https://blog.example/p/x/': { url: '/p/x/', title: 'Post X' },
    'https://blog.example/p/y/': { url: '/p/y/', title: 'Post Y' },
  };
  const locate = (address: string) => pages[address];

  it('lists all comments of the site, newest first, replies and roots mixed', async () => {
    const list = await recentComments(
      [
        c({ id: 'a', time: '2026-11-01T10:00:00Z' }),
        c({
          id: 'b',
          pid: 'a',
          time: '2026-11-03T10:00:00Z',
          user: { name: 'Bernd' },
        }),
        c({
          id: 'c',
          time: '2026-11-02T10:00:00Z',
          locator: { url: 'https://blog.example/p/y/' },
        }),
      ],
      locate,
    );
    expect(list.map((x) => x.id)).toEqual(['b', 'c', 'a']);
    expect(list[1]?.page).toEqual({ url: '/p/y/', title: 'Post Y' });
  });

  it('names what a reply answers, with a short quote', async () => {
    const long = '<p>' + 'Wort '.repeat(80) + '</p>';
    const [reply] = await recentComments(
      [
        c({ id: 'a', text: long, user: { name: 'Anna' } }),
        c({ id: 'b', pid: 'a', time: '2026-11-05T10:00:00Z' }),
      ],
      locate,
    );
    const quote = reply?.replyTo;
    expect(quote).toMatchObject({ id: 'a', author: 'Anna' });
    expect(quote?.excerpt).toMatch(/^Wort( Wort)*…$/);
    expect(quote?.excerpt.length).toBeLessThanOrEqual(140);
  });

  it('leaves out deleted comments and comments on pages that do not exist', async () => {
    const list = await recentComments(
      [
        c({ id: 'a', delete: true }),
        c({ id: 'b', locator: { url: 'https://blog.example/p/weg/' } }),
        c({ id: 'd' }),
      ],
      locate,
    );
    expect(list.map((x) => x.id)).toEqual(['d']);
  });

  it('keeps a reply to a deleted or missing comment, with an empty quote', async () => {
    const list = await recentComments(
      [
        c({ id: 'a', delete: true, text: 'geheim', user: { name: 'Weg' } }),
        c({ id: 'b', pid: 'a', time: '2026-11-05T10:00:00Z' }),
        c({ id: 'd', pid: 'fehlt', time: '2026-11-06T10:00:00Z' }),
      ],
      locate,
    );
    expect(list.map((x) => [x.id, x.replyTo])).toEqual([
      ['d', { id: 'fehlt', author: '', excerpt: '' }],
      ['b', { id: 'a', author: '', excerpt: '' }],
    ]);
    expect(JSON.stringify(list)).not.toContain('geheim');
  });

  it('sanitizes the text like everywhere else and breaks ties by id', async () => {
    const list = await recentComments(
      [
        c({
          id: 'a',
          text: '<p>x</p><script>alert(1)</script><img src="https://e/t.png">',
        }),
        c({ id: 'b' }),
      ],
      locate,
    );
    expect(list.map((x) => x.id)).toEqual(['b', 'a']);
    expect(list[1]?.html).not.toMatch(/script|<img/);
  });

  it('does not change the list it gets', async () => {
    const input = [
      c({ id: 'a', time: '2026-11-01T10:00:00Z' }),
      c({ id: 'b', time: '2026-11-02T10:00:00Z' }),
    ];
    await recentComments(input, locate);
    expect(input.map((x) => x.id)).toEqual(['a', 'b']);
  });
});
