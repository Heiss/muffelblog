import type { FeedItem } from '@muffelblog/core';
import { describe, expect, it } from 'vitest';
import { liveEntries } from './live';

const item = (n: number, over: Partial<FeedItem> = {}): FeedItem => ({
  kind: 'post',
  id: `post:p${n}`,
  url: `/p/p${n}/`,
  title: `Title ${n}`,
  created: new Date(Date.UTC(2026, 10, 30 - n)),
  updated: new Date(Date.UTC(2026, 10, 30 - n)),
  tags: [],
  excerpt: 'text',
  ...over,
});

describe('liveEntries', () => {
  it('lists the newest entries with id, kind, date and tag addresses only', () => {
    const live = liveEntries(
      [
        item(1, {
          kind: 'memo',
          id: 'memo:m',
          tags: ['Über Größe', 'a/b', 'tooling'],
          html: '<p>secret</p>',
        }),
        item(2),
      ],
      20,
    );
    expect(live).toEqual({
      limit: 20,
      entries: [
        {
          id: 'memo:m',
          kind: 'memo',
          date: '2026-11-29T00:00:00.000Z',
          tags: ['ueber-groesse', 'a-b', 'tooling'],
        },
        {
          id: 'post:p2',
          kind: 'post',
          date: '2026-11-28T00:00:00.000Z',
          tags: [],
        },
      ],
    });
    const text = JSON.stringify(live);
    expect(text).not.toContain('secret');
    expect(text).not.toContain('Title');
  });

  it('cuts the list at the limit and keeps the order', () => {
    const items = Array.from({ length: 30 }, (_, i) => item(i + 1));
    const live = liveEntries(items, 20);
    expect(live.entries).toHaveLength(20);
    expect(live.entries[0]?.id).toBe('post:p1');
    expect(live.entries[19]?.id).toBe('post:p20');
  });

  it('names the bundle of terms that the home page shows as one entry', () => {
    const day = (h: number) => new Date(Date.UTC(2026, 10, 13, h));
    const live = liveEntries(
      [
        item(1, { kind: 'glossary', id: 'glossary:a', created: day(12) }),
        item(2, { kind: 'glossary', id: 'glossary:b', created: day(11) }),
        item(3, { created: day(10) }),
        item(4, {
          kind: 'glossary',
          id: 'glossary:c',
          created: new Date(Date.UTC(2026, 10, 10, 12)),
        }),
      ],
      20,
    );
    expect(live.entries.map((e) => [e.id, e.bundle])).toEqual([
      ['glossary:a', 'bundle:2026-11-13'],
      ['glossary:b', 'bundle:2026-11-13'],
      ['post:p3', undefined],
      ['glossary:c', undefined],
    ]);
    expect(live.entries[2]).not.toHaveProperty('bundle');
  });

  it('is empty for an empty feed', () => {
    expect(liveEntries([], 20)).toEqual({ limit: 20, entries: [] });
  });
});
