import { describe, expect, it } from 'vitest';
import type { FeedItem, MemoEntry, TagGroup } from '@muffelblog/core';
import { groupByDay, relatedMemos, tagCloud } from './timeline';

function item(id: string, created: string, updated = created): FeedItem {
  return {
    kind: 'post',
    id,
    url: `/p/${id}/`,
    title: id,
    created: new Date(created),
    updated: new Date(updated),
    tags: [],
    excerpt: '',
  };
}

describe('groupByDay', () => {
  it('groups consecutive rows of the same Berlin day, keeping the order', () => {
    const rows = [
      item('a', '2026-11-17T20:00:00Z'),
      item('b', '2026-11-17T08:00:00Z'),
      item('c', '2026-11-16T23:30:00Z'),
      item('d', '2026-11-16T22:30:00Z'),
    ];
    const groups = groupByDay(rows);
    expect(groups).toEqual([
      { day: '2026-11-17', date: rows[0]?.created, rows: rows.slice(0, 3) },
      { day: '2026-11-16', date: rows[3]?.created, rows: rows.slice(3) },
    ]);
  });

  it('uses the date the list is sorted by', () => {
    const rows = [
      item('a', '2026-11-01T10:00:00Z', '2026-11-20T10:00:00Z'),
      item('b', '2026-11-02T10:00:00Z', '2026-11-20T09:00:00Z'),
    ];
    expect(groupByDay(rows, 'updated').map((g) => g.day)).toEqual([
      '2026-11-20',
    ]);
    expect(groupByDay(rows).map((g) => g.day)).toEqual([
      '2026-11-01',
      '2026-11-02',
    ]);
  });

  it('is empty for no rows', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

function memo(uid: string, created: string, tags: string[]): MemoEntry {
  return {
    uid,
    path: `memos/${uid}`,
    title: uid,
    description: '',
    created: new Date(created),
    updated: new Date(created),
    tags,
    html: '',
  };
}

describe('relatedMemos', () => {
  const memos = [
    memo('self', '2026-08-11T05:56:00Z', ['selfhost', 'Nextcloud']),
    memo('old', '2026-07-21T19:34:00Z', ['selfhost']),
    memo('new', '2026-11-03T06:12:00Z', ['nextcloud']),
    memo('mid', '2026-08-07T16:59:00Z', ['SelfHost', 'other']),
    memo('none', '2026-11-04T06:12:00Z', ['other']),
    memo('untagged', '2026-11-05T06:12:00Z', []),
  ];
  const self = memos[0] as MemoEntry;

  it('lists memos sharing any tag, newest first, without the memo itself', () => {
    const related = relatedMemos(self, memos);
    expect(related.memos.map((m) => m.uid)).toEqual(['new', 'mid', 'old']);
    expect(related.total).toBe(3);
  });

  it('limits the list but counts all', () => {
    const related = relatedMemos(self, memos, 2);
    expect(related.memos.map((m) => m.uid)).toEqual(['new', 'mid']);
    expect(related.total).toBe(3);
  });

  it('names the tags of the memo with the number of memos per tag', () => {
    expect(relatedMemos(self, memos).tags).toEqual([
      { slug: 'selfhost', name: 'selfhost', count: 3 },
      { slug: 'nextcloud', name: 'Nextcloud', count: 2 },
    ]);
  });

  it('finds nothing for a memo without tags', () => {
    expect(relatedMemos(memos[5] as MemoEntry, memos)).toEqual({
      memos: [],
      total: 0,
      tags: [],
    });
  });

  it('ignores tags without an address', () => {
    const odd = memo('odd', '2026-01-01T00:00:00Z', ['???']);
    expect(
      relatedMemos(odd, [odd, memo('x', '2026-01-02T00:00:00Z', ['???'])]),
    ).toEqual({ memos: [], total: 0, tags: [] });
  });
});

function group(slug: string, count: number, names = [slug]): TagGroup {
  return { slug, names, count, items: [] };
}

describe('tagCloud', () => {
  it('gives steps from 1 to 6 on a logarithmic scale', () => {
    const cloud = tagCloud([
      group('a', 1),
      group('b', 7),
      group('c', 55),
      group('d', 2, ['D-tag', 'd']),
    ]);
    expect(cloud).toEqual([
      { slug: 'a', name: 'a', count: 1, step: 1 },
      { slug: 'b', name: 'b', count: 7, step: 3 },
      { slug: 'c', name: 'c', count: 55, step: 6 },
      { slug: 'd', name: 'D-tag', count: 2, step: 2 },
    ]);
  });

  it('gives every tag step 1 when each is used once, and nothing for no tags', () => {
    expect(tagCloud([group('a', 1), group('b', 1)]).map((t) => t.step)).toEqual(
      [1, 1],
    );
    expect(tagCloud([])).toEqual([]);
  });

  it('falls back to the address when a group has no name', () => {
    expect(tagCloud([group('x', 3, [])])[0]?.name).toBe('x');
  });
});
