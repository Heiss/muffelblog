import type { RemarkComment, RemarkSource } from '@muffelblog/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// commentsFor keeps state per build (one source, one big request, a cache per
// page), so every test loads a fresh copy of the module.

const made = vi.hoisted(() => ({
  remark: [] as unknown[],
  fixtures: [] as string[],
  source: undefined as RemarkSource | undefined,
}));

vi.mock('@muffelblog/core', async (importOriginal) => {
  const real = await importOriginal<typeof import('@muffelblog/core')>();
  return {
    ...real,
    createRemarkSource: (options: unknown) => {
      made.remark.push(options);
      return made.source;
    },
    createFixtureRemarkSource: (folder: string) => {
      made.fixtures.push(folder);
      return made.source;
    },
  };
});

const comment = (id: string, url: string): RemarkComment => ({
  id,
  text: `<p>${id}</p>`,
  user: { name: 'Ann' },
  time: '2026-01-01T10:00:00Z',
  locator: { url },
});

function fakeSource(all: RemarkComment[]) {
  const calls = { last: [] as number[], find: [] as string[] };
  made.source = {
    last: async (limit: number) => {
      calls.last.push(limit);
      return { comments: all, warnings: ['late entry'] };
    },
    find: async (url: string) => {
      calls.find.push(url);
      return {
        comments: all.filter((c) => c.locator.url === url),
        warnings: ['odd entry'],
      };
    },
  } as unknown as RemarkSource;
  return calls;
}

const load = async () => (await import('./comments-static')).commentsFor;

beforeEach(() => {
  vi.resetModules();
  made.remark = [];
  made.fixtures = [];
  made.source = undefined;
  vi.stubEnv('MUFFEL_FIXTURES', '');
  vi.stubEnv('REMARK_INTERNAL_URL', '');
  vi.stubEnv('SITE_URL', '');
  vi.stubEnv('COMMENTS_SITE_ID', '');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('commentsFor', () => {
  it('has nothing without a source', async () => {
    const commentsFor = await load();
    expect(await commentsFor('/p/a/')).toBeUndefined();
    expect(await commentsFor('/p/a/')).toBeUndefined();
    expect(made.remark).toEqual([]);
  });

  it('asks Remark42 once for the whole site and picks the page by its address', async () => {
    vi.stubEnv('REMARK_INTERNAL_URL', 'http://remark42:8080');
    vi.stubEnv('SITE_URL', 'https://blog.example');
    vi.stubEnv('COMMENTS_SITE_ID', 'site_1');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const calls = fakeSource([
      comment('a', 'https://blog.example/p/a/'),
      comment('b', 'https://blog.example/p/b/'),
    ]);
    const commentsFor = await load();
    const first = await commentsFor('/p/a/');
    const again = await commentsFor('/p/a/');
    const other = await commentsFor('/p/b/');
    expect(first?.map((n) => n.id)).toEqual(['a']);
    expect(again).toBe(first);
    expect(other?.map((n) => n.id)).toEqual(['b']);
    expect(calls).toEqual({ last: [1000], find: [] });
    expect(made.remark).toEqual([
      expect.objectContaining({
        baseUrl: 'http://remark42:8080',
        site: 'site_1',
        timeoutMs: expect.any(Number),
      }),
    ]);
    expect(warn.mock.calls).toEqual([['[comments] late entry']]);
  });

  it('asks per page when the big answer may be cut off', async () => {
    vi.stubEnv('REMARK_INTERNAL_URL', 'http://remark42:8080');
    vi.stubEnv('SITE_URL', 'https://blog.example');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const many = Array.from({ length: 1000 }, (_, i) =>
      comment(`c${i}`, 'https://blog.example/p/x/'),
    );
    const calls = fakeSource(
      [...many, comment('a', 'https://blog.example/p/a/')].slice(0, 1000),
    );
    const commentsFor = await load();
    expect(await commentsFor('/p/a/')).toEqual([]);
    expect(calls.find).toEqual(['https://blog.example/p/a/']);
    expect(warn.mock.calls).toContainEqual([
      '[comments] https://blog.example/p/a/: odd entry',
    ]);
  });

  it('reads the sample comments by path when fixtures are on', async () => {
    vi.stubEnv('MUFFEL_FIXTURES', '1');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    fakeSource([comment('a', '/p/a/'), comment('b', '/p/b/')]);
    const commentsFor = await load();
    expect((await commentsFor('/p/a/'))?.map((n) => n.id)).toEqual(['a']);
    expect(made.fixtures).toHaveLength(1);
    expect(made.fixtures[0]).toMatch(/packages\/core\/fixtures\/comments$/);
  });
});
