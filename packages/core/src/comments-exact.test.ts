import { describe, expect, it } from 'vitest';
import {
  commentsFingerprint,
  forPage,
  parseComments,
  toTree,
  type RemarkComment,
} from './comments.ts';

// Exact checks of reading, ordering and the fingerprint of comments.

const raw = (extra: Record<string, unknown> = {}) => ({
  id: 'c1',
  text: '<p>hi</p>',
  user: { name: 'Ann' },
  time: '2026-01-01T10:00:00Z',
  locator: { url: 'https://blog.example/p/a/' },
  ...extra,
});

const comment = (
  id: string,
  extra: Partial<RemarkComment> = {},
): RemarkComment => ({
  id,
  text: `<p>${id}</p>`,
  user: { name: 'Ann' },
  time: '2026-01-01T10:00:00Z',
  locator: { url: 'https://blog.example/p/a/' },
  ...extra,
});

describe('parseComments', () => {
  it('keeps exactly the used fields', () => {
    const { comments, warnings } = parseComments([
      raw({ pid: 'p0', delete: true, extra: 1, user: { name: 'Ann', x: 1 } }),
    ]);
    expect(warnings).toEqual([]);
    expect(comments).toEqual([
      {
        id: 'c1',
        pid: 'p0',
        text: '<p>hi</p>',
        user: { name: 'Ann' },
        time: '2026-01-01T10:00:00Z',
        delete: true,
        locator: { url: 'https://blog.example/p/a/' },
      },
    ]);
  });

  it('leaves out an empty or missing parent, a false delete and a bad locator', () => {
    const { comments } = parseComments([
      raw({ pid: '', delete: false, locator: 'x' }),
      raw({ id: 'c2', pid: 3, delete: 'yes', locator: { url: 5 } }),
      raw({ id: 'c3', locator: null }),
    ]);
    for (const c of comments) {
      expect(c).not.toHaveProperty('pid');
      expect(c).not.toHaveProperty('delete');
      expect(c.locator).toEqual({ url: '' });
    }
  });

  it('names why an entry is skipped', () => {
    const { comments, warnings } = parseComments([
      null,
      [raw()],
      raw({ id: '' }),
      raw({ id: 5 }),
      raw({ text: 5 }),
      raw({ user: null }),
      raw({ user: { name: 5 } }),
      raw({ user: [] }),
      raw({ time: 5 }),
      raw({ time: 'never' }),
    ]);
    expect(comments).toEqual([]);
    expect(warnings).toEqual([
      'Comment skipped: not an object',
      'Comment skipped: not an object',
      'Comment skipped: no id',
      'Comment skipped: no id',
      'Comment skipped: comment c1: no text',
      'Comment skipped: comment c1: no author',
      'Comment skipped: comment c1: no author',
      'Comment skipped: comment c1: no author',
      'Comment skipped: comment c1: invalid time',
      'Comment skipped: comment c1: invalid time',
    ]);
  });

  it('reads a list or an object with comments, else throws', () => {
    expect(parseComments({ comments: [raw()] }).comments).toHaveLength(1);
    expect(parseComments({ comments: null }).comments).toEqual([]);
    expect(() => parseComments({ comments: {} })).toThrow(
      'Unexpected answer of Remark42 (comments is not a list)',
    );
    expect(() => parseComments({})).toThrow(
      'Unexpected answer of Remark42 (no comments)',
    );
    expect(() => parseComments('x')).toThrow(
      'Unexpected answer of Remark42 (no comments)',
    );
  });
});

describe('toTree', () => {
  it('orders by time, on the same time by id, and renders the text', async () => {
    const tree = await toTree([
      comment('b'),
      comment('a'),
      comment('c', { time: '2026-01-01T09:00:00Z' }),
    ]);
    expect(tree.map((n) => n.id)).toEqual(['c', 'a', 'b']);
    expect(tree[1]).toEqual({
      id: 'a',
      author: 'Ann',
      time: '2026-01-01T10:00:00.000Z',
      html: '<p>a</p>',
      deleted: false,
      replies: [],
    });
  });

  it('removes images and foreign content from the text', async () => {
    const [node] = await toTree([
      comment('a', {
        text: '<p><img src="https://x.example/i.png" alt="i">t</p>',
      }),
    ]);
    expect(node?.html).toBe('<p>it</p>');
  });

  it('keeps a deleted comment only for its replies, without text', async () => {
    const tree = await toTree([
      comment('a', { delete: true }),
      comment('b', { pid: 'a' }),
      comment('c', { delete: true }),
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ id: 'a', html: '', deleted: true });
    expect(tree[0]?.replies.map((r) => r.id)).toEqual(['b']);
  });

  it('makes a reply to an unknown comment a root', async () => {
    const tree = await toTree([comment('a', { pid: 'gone' })]);
    expect(tree.map((n) => n.id)).toEqual(['a']);
  });

  it('breaks loops at their oldest member and keeps everybody', async () => {
    const tree = await toTree([
      comment('x', { pid: 'y', time: '2026-01-01T10:00:02Z' }),
      comment('y', { pid: 'z', time: '2026-01-01T10:00:01Z' }),
      comment('z', { pid: 'x', time: '2026-01-01T10:00:03Z' }),
      comment('w', { pid: 'x', time: '2026-01-01T10:00:00Z' }),
    ]);
    expect(tree.map((n) => n.id)).toEqual(['y']);
    const x = tree[0]?.replies[0];
    expect(x?.id).toBe('x');
    expect(x?.replies.map((r) => r.id)).toEqual(['w', 'z']);
    expect(x?.replies[1]?.replies).toEqual([]);
  });

  it('breaks a loop of one', async () => {
    const tree = await toTree([comment('a', { pid: 'a' })]);
    expect(tree.map((n) => n.id)).toEqual(['a']);
    expect(tree[0]?.replies).toEqual([]);
  });

  it('breaks two loops independently', async () => {
    const tree = await toTree([
      comment('a', { pid: 'b' }),
      comment('b', { pid: 'a', time: '2026-01-01T09:00:00Z' }),
      comment('c', { pid: 'd', time: '2026-01-01T08:00:00Z' }),
      comment('d', { pid: 'c' }),
      comment('e', { pid: 'a', time: '2026-01-01T07:00:00Z' }),
    ]);
    expect(tree.map((n) => n.id)).toEqual(['c', 'b']);
    expect(tree[1]?.replies[0]?.id).toBe('a');
    expect(tree[1]?.replies[0]?.replies[0]?.id).toBe('e');
  });
});

describe('commentsFingerprint', () => {
  const base = comment('a', { pid: 'p' });
  it('ignores the order and changes with every field', () => {
    const other = comment('b');
    const before = commentsFingerprint([base, other]);
    expect(commentsFingerprint([other, base])).toBe(before);
    for (const changed of [
      { ...base, id: 'z' },
      { ...base, pid: 'q' },
      { ...base, time: '2027-01-01T00:00:00Z' },
      { ...base, text: 'x' },
      { ...base, user: { name: 'Bob' } },
      { ...base, delete: true },
      { ...base, locator: { url: 'https://blog.example/p/b/' } },
    ]) {
      expect(commentsFingerprint([changed, other])).not.toBe(before);
    }
  });

  it('treats a missing parent like an empty one and a missing delete like false', () => {
    const plain = comment('a');
    expect(commentsFingerprint([plain])).toBe(
      commentsFingerprint([{ ...plain, pid: '' } as RemarkComment]),
    );
    expect(commentsFingerprint([plain])).toBe(
      commentsFingerprint([{ ...plain, delete: false }]),
    );
    expect(commentsFingerprint([])).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('forPage', () => {
  const at = (url: string) => comment(url, { locator: { url } });
  const all = [
    at('https://blog.example/p/a/'),
    at('https://BLOG.example:443/p/a/'),
    at('https://blog.example/p/b/'),
    at('not an address'),
    at('/p/a/'),
  ];

  it('finds a page by any equal form of its address', () => {
    expect(forPage(all, 'https://blog.example/p/a/').map((c) => c.id)).toEqual([
      'https://blog.example/p/a/',
      'https://BLOG.example:443/p/a/',
    ]);
  });

  it('compares a path key by path only', () => {
    expect(forPage(all, '/p/a/').map((c) => c.id)).toEqual([
      'https://blog.example/p/a/',
      'https://BLOG.example:443/p/a/',
      '/p/a/',
    ]);
  });

  it('compares an unparsable key as it is', () => {
    expect(forPage(all, 'not an address').map((c) => c.id)).toEqual([
      'not an address',
    ]);
    expect(forPage(all, 'p/a/')).toEqual([]);
  });
});
