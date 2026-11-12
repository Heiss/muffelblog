import { describe, expect, it, vi } from 'vitest';
import {
  countNew,
  createLive,
  parseLive,
  scopeFor,
  type LiveEntry,
} from './live-logic';

const e = (
  id: string,
  date: string,
  kind: LiveEntry['kind'] = 'post',
  tags: string[] = [],
): LiveEntry => ({ id, kind, date, tags });

describe('parseLive', () => {
  it('reads the entries and drops what it does not know', () => {
    const parsed = parseLive({
      limit: 20,
      entries: [
        {
          id: 'post:a',
          kind: 'post',
          date: '2026-11-04T10:00:00.000Z',
          tags: ['x'],
          extra: 1,
        },
      ],
    });
    expect(parsed).toEqual({
      limit: 20,
      entries: [
        {
          id: 'post:a',
          kind: 'post',
          date: '2026-11-04T10:00:00.000Z',
          tags: ['x'],
        },
      ],
    });
  });

  it('refuses anything that is not what the site writes', () => {
    for (const bad of [
      null,
      'x',
      [],
      {},
      { limit: 20 },
      { limit: 0, entries: [] },
      { limit: 'a', entries: [] },
      {
        limit: 20,
        entries: [
          { id: 1, kind: 'post', date: '2026-11-04T10:00:00Z', tags: [] },
        ],
      },
      {
        limit: 20,
        entries: [
          { id: 'x', kind: 'page', date: '2026-11-04T10:00:00Z', tags: [] },
        ],
      },
      {
        limit: 20,
        entries: [{ id: 'x', kind: 'post', date: 'not a date', tags: [] }],
      },
      {
        limit: 20,
        entries: [
          { id: 'x', kind: 'post', date: '2026-11-04T10:00:00Z', tags: [1] },
        ],
      },
    ]) {
      expect(parseLive(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe('scopeFor', () => {
  it('knows the series and the tag pages', () => {
    expect(scopeFor('/')).toEqual({ kind: 'all' });
    expect(scopeFor('/posts/')).toEqual({ kind: 'post' });
    expect(scopeFor('/updated/')).toEqual({ kind: 'all' });
    expect(scopeFor('/posts/updated/')).toEqual({ kind: 'post' });
    expect(scopeFor('/memos/updated/')).toEqual({ kind: 'memo' });
    expect(scopeFor('/terms/updated/')).toEqual({ kind: 'glossary' });
    expect(scopeFor('/tag/tooling/')).toEqual({ kind: 'all', tag: 'tooling' });
    expect(scopeFor('/tag/a-b/')).toEqual({ kind: 'all', tag: 'a-b' });
  });

  it('is null where no banner belongs: later blocks and other pages', () => {
    expect(scopeFor('/page/2/')).toBeNull();
    expect(scopeFor('/memos/page/3/')).toBeNull();
    expect(scopeFor('/updated/page/2/')).toBeNull();
    expect(scopeFor('/tag/x/page/2/')).toBeNull();
    expect(scopeFor('/p/hallo/')).toBeNull();
  });
});

describe('countNew', () => {
  const loaded = [
    { id: 'post:b', date: '2026-11-03T10:00:00.000Z' },
    { id: 'memo:m', date: '2026-11-02T10:00:00.000Z' },
  ];

  it('counts only entries that are newer than the newest loaded one', () => {
    const r = countNew(
      [
        e('post:n2', '2026-11-05T10:00:00.000Z'),
        e('post:n1', '2026-11-04T10:00:00.000Z'),
        e('post:b', '2026-11-03T10:00:00.000Z'),
        e('post:old', '2026-10-01T10:00:00.000Z'),
      ],
      loaded,
      { kind: 'all' },
      20,
    );
    expect(r).toEqual({ count: 2, more: false });
  });

  it('does not count a back-dated entry or one with the same time', () => {
    expect(
      countNew(
        [
          e('post:same', '2026-11-03T10:00:00.000Z'),
          e('post:back', '2026-10-30T10:00:00.000Z'),
        ],
        loaded,
        { kind: 'all' },
        20,
      ).count,
    ).toBe(0);
  });

  it('does not count what is already in the list', () => {
    expect(
      countNew(
        [e('post:b', '2026-11-09T10:00:00.000Z')],
        loaded,
        { kind: 'all' },
        20,
      ).count,
    ).toBe(0);
  });

  it('counts only the kind of the series', () => {
    const entries = [
      e('post:p', '2026-11-05T10:00:00.000Z', 'post'),
      e('memo:m1', '2026-11-05T11:00:00.000Z', 'memo'),
      e('glossary:g', '2026-11-05T12:00:00.000Z', 'glossary'),
    ];
    expect(countNew(entries, loaded, { kind: 'post' }, 20).count).toBe(1);
    expect(countNew(entries, loaded, { kind: 'memo' }, 20).count).toBe(1);
    expect(countNew(entries, loaded, { kind: 'glossary' }, 20).count).toBe(1);
    expect(countNew(entries, loaded, { kind: 'all' }, 20).count).toBe(3);
  });

  it('counts only entries with the tag on a tag page', () => {
    const entries = [
      e('post:a', '2026-11-05T10:00:00.000Z', 'post', ['tooling']),
      e('post:b2', '2026-11-05T11:00:00.000Z', 'post', ['other']),
    ];
    expect(
      countNew(entries, loaded, { kind: 'all', tag: 'tooling' }, 20).count,
    ).toBe(1);
  });

  it('says "more" when the whole window is new, so there may be entries beyond it', () => {
    const entries = [
      e('post:3', '2026-11-08T10:00:00.000Z'),
      e('post:2', '2026-11-07T10:00:00.000Z'),
      e('post:1', '2026-11-06T10:00:00.000Z'),
    ];
    expect(countNew(entries, loaded, { kind: 'all' }, 3)).toEqual({
      count: 3,
      more: true,
    });
    expect(countNew(entries, loaded, { kind: 'all' }, 4)).toEqual({
      count: 3,
      more: false,
    });
  });

  it('counts every entry when nothing is loaded yet', () => {
    expect(
      countNew(
        [e('post:a', '2026-11-05T10:00:00.000Z')],
        [],
        { kind: 'all' },
        20,
      ).count,
    ).toBe(1);
  });
});

describe('createLive', () => {
  const entries = (...list: LiveEntry[]) => ({ limit: 20, entries: list });
  function make(
    builds: (string | null)[],
    lists: (ReturnType<typeof entries> | null)[],
  ) {
    const show = vi.fn();
    const getBuild = vi.fn(async () => builds.shift() ?? null);
    const getEntries = vi.fn(async () => lists.shift() ?? null);
    const live = createLive({
      getBuild,
      getEntries,
      loaded: () => [{ id: 'post:b', date: '2026-11-03T10:00:00.000Z' }],
      scope: () => ({ kind: 'all' }),
      show,
    });
    return { live, show, getBuild, getEntries };
  }

  it('remembers the first build and asks for nothing more while it stays', async () => {
    const x = make(['b1', 'b1', 'b1'], []);
    await x.live.poll();
    await x.live.poll();
    await x.live.poll();
    expect(x.getEntries).not.toHaveBeenCalled();
    expect(x.show).not.toHaveBeenCalled();
  });

  it('shows the banner with the number when a new build brings newer entries', async () => {
    const x = make(
      ['b1', 'b2'],
      [
        entries(
          e('post:n', '2026-11-05T10:00:00.000Z'),
          e('post:b', '2026-11-03T10:00:00.000Z'),
        ),
      ],
    );
    await x.live.poll();
    await x.live.poll();
    expect(x.show).toHaveBeenCalledWith({ count: 1, more: false });
  });

  it('stays quiet when only a comment changed: new build, same entries', async () => {
    const x = make(
      ['b1', 'b2'],
      [entries(e('post:b', '2026-11-03T10:00:00.000Z'))],
    );
    await x.live.poll();
    await x.live.poll();
    expect(x.getEntries).toHaveBeenCalledTimes(1);
    expect(x.show).not.toHaveBeenCalled();
  });

  it('does not ask for the list again for the same build', async () => {
    const x = make(
      ['b1', 'b2', 'b2'],
      [entries(e('post:b', '2026-11-03T10:00:00.000Z'))],
    );
    await x.live.poll();
    await x.live.poll();
    await x.live.poll();
    expect(x.getEntries).toHaveBeenCalledTimes(1);
  });

  it('tries the list again at the next poll when it could not be read', async () => {
    const x = make(
      ['b1', 'b2', 'b2'],
      [null, entries(e('post:n', '2026-11-05T10:00:00.000Z'))],
    );
    await x.live.poll();
    await x.live.poll();
    expect(x.show).not.toHaveBeenCalled();
    await x.live.poll();
    expect(x.show).toHaveBeenCalledWith({ count: 1, more: false });
  });

  it('ignores a failed read of build.json', async () => {
    const x = make(['b1', null, 'b1'], []);
    await x.live.poll();
    await x.live.poll();
    await x.live.poll();
    expect(x.show).not.toHaveBeenCalled();
  });

  it('does nothing where no banner belongs', async () => {
    const getBuild = vi.fn(async () => 'b1');
    const live = createLive({
      getBuild,
      getEntries: async () => null,
      loaded: () => [],
      scope: () => null,
      show: vi.fn(),
    });
    await live.poll();
    expect(getBuild).not.toHaveBeenCalled();
  });
});
