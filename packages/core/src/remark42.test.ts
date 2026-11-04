import { describe, expect, it } from 'vitest';
import { createRemarkSource } from './remark42.ts';

const comment = {
  id: 'a',
  text: 't',
  user: { name: 'N' },
  time: '2026-11-04T10:00:00Z',
  locator: { url: 'u' },
};

function fake(answer: unknown, status = 200) {
  const urls: string[] = [];
  const doFetch = (async (url: string) => {
    urls.push(String(url));
    return new Response(JSON.stringify(answer), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { urls, doFetch };
}

describe('createRemarkSource', () => {
  it('reads the latest comments of the site', async () => {
    const { urls, doFetch } = fake([comment]);
    const source = createRemarkSource({
      baseUrl: 'http://remark42:8080/',
      site: 'muffelblog',
      fetch: doFetch,
    });
    expect((await source.last(500)).comments).toHaveLength(1);
    expect(urls[0]).toBe(
      'http://remark42:8080/api/v1/last/500?site=muffelblog',
    );
  });

  it('finds the comments of one page by its address, flat and by time', async () => {
    const { urls, doFetch } = fake({ comments: [comment], info: {} });
    const source = createRemarkSource({
      baseUrl: 'http://remark42:8080',
      site: 'muffelblog',
      fetch: doFetch,
    });
    await source.find('https://blog.example/p/ä b/');
    const url = new URL(urls[0] as string);
    expect(url.pathname).toBe('/api/v1/find');
    expect(url.searchParams.get('site')).toBe('muffelblog');
    expect(url.searchParams.get('url')).toBe('https://blog.example/p/ä b/');
    expect(url.searchParams.get('format')).toBe('plain');
    expect(url.searchParams.get('sort')).toBe('time');
  });

  it('waits and tries again when Remark42 says 429 (rate limit)', async () => {
    let calls = 0;
    const doFetch = (async () => {
      calls += 1;
      return calls < 3
        ? new Response('{"error":"limit"}', {
            status: 429,
            headers: { 'retry-after': '2' },
          })
        : new Response(JSON.stringify([comment]), { status: 200 });
    }) as unknown as typeof fetch;
    const waits: number[] = [];
    const source = createRemarkSource({
      baseUrl: 'http://remark42:8080',
      site: 's',
      fetch: doFetch,
      sleep: async (ms) => void waits.push(ms),
    });
    expect((await source.last(10)).comments).toHaveLength(1);
    expect(calls).toBe(3);
    expect(waits).toEqual([2000, 2000]);
  });

  it('gives up after a few rate limit answers', async () => {
    const doFetch = (async () =>
      new Response('', { status: 429 })) as unknown as typeof fetch;
    const source = createRemarkSource({
      baseUrl: 'http://remark42:8080',
      site: 's',
      fetch: doFetch,
      sleep: async () => undefined,
    });
    await expect(source.last(10)).rejects.toThrow(/429/);
  });

  it('fails when Remark42 answers with an error, so the build stops', async () => {
    const { doFetch } = fake({ error: 'x' }, 500);
    const source = createRemarkSource({
      baseUrl: 'http://remark42:8080',
      site: 's',
      fetch: doFetch,
    });
    await expect(source.last(10)).rejects.toThrow(/500/);
    await expect(source.find('u')).rejects.toThrow(/500/);
  });

  it('fails when Remark42 cannot be reached', async () => {
    const down = (async () => {
      throw new Error('connect ECONNREFUSED');
    }) as unknown as typeof fetch;
    const source = createRemarkSource({
      baseUrl: 'http://remark42:8080',
      site: 's',
      fetch: down,
    });
    await expect(source.last(10)).rejects.toThrow(/unreachable/i);
  });

  it('refuses a base address that is not http(s)', () => {
    expect(() => createRemarkSource({ baseUrl: 'ftp://x', site: 's' })).toThrow(
      /REMARK_INTERNAL_URL/,
    );
    expect(() =>
      createRemarkSource({ baseUrl: 'nonsense', site: 's' }),
    ).toThrow(/REMARK_INTERNAL_URL/);
  });
});

describe('createFixtureRemarkSource', () => {
  it('finds the comments of a page by its path, whatever the origin', async () => {
    const { mkdtemp, writeFile } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { createFixtureRemarkSource } = await import('./remark42.ts');
    const dir = await mkdtemp(join(tmpdir(), 'muffel-rc-'));
    await writeFile(
      join(dir, 'comments.json'),
      JSON.stringify([
        { ...comment, id: 'a', locator: { url: '/p/x/' } },
        { ...comment, id: 'b', locator: { url: '/p/y/' } },
      ]),
    );
    const source = createFixtureRemarkSource(dir);
    expect(
      (await source.find('https://blog.example/p/x/')).comments.map(
        (c) => c.id,
      ),
    ).toEqual(['a']);
    expect((await source.find('/p/y/')).comments.map((c) => c.id)).toEqual([
      'b',
    ]);
    expect((await source.find('/p/none/')).comments).toEqual([]);
    expect((await source.last(10)).comments).toHaveLength(2);
  });
});
