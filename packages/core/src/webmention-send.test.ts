import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './config.ts';
import {
  emptyWebmentionState,
  runWebmentionSend,
  type SendDeps,
  type SourceEntry,
  type WebmentionState,
} from './webmention-send.ts';
import type { SafeResponse } from './webmention-net.ts';

const SITE = 'https://blog.example';
const T0 = new Date('2026-11-04T12:00:00Z');

interface Call {
  url: string;
  method: string;
  body?: string;
}

/** A fake internet: pages by address, endpoints by host. */
function fakeNet(
  pages: Record<string, Partial<SafeResponse> | Error> = {},
  post: (call: Call) => Partial<SafeResponse> | Error = () => ({ status: 202 }),
) {
  const calls: Call[] = [];
  const fetch: SendDeps['fetch'] = async (url, init) => {
    const call = { url, method: init.method ?? 'GET', body: init.body };
    calls.push(call);
    const answer =
      call.method === 'POST' ? post(call) : (pages[url] ?? { status: 404 });
    if (answer instanceof Error) throw answer;
    return {
      status: 200,
      url,
      headers: {},
      body: '',
      truncated: false,
      ...answer,
    };
  };
  return { calls, fetch };
}

const entry = (path: string, hash: string, links: string[]): SourceEntry => ({
  source: `${SITE}${path}`,
  hash,
  links,
});

const withEndpoint = (endpoint: string): Partial<SafeResponse> => ({
  headers: { link: `<${endpoint}>; rel="webmention"` },
});

function deps(
  net: ReturnType<typeof fakeNet>,
  over: Partial<SendDeps> = {},
): SendDeps & { sleeps: number[] } {
  const sleeps: number[] = [];
  return {
    fetch: net.fetch,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    now: () => T0,
    log: () => {},
    settings: { ...DEFAULT_SETTINGS, webmentionsSend: true },
    siteUrl: SITE,
    ...over,
    sleeps,
  };
}

/** Runs once on an empty state to baseline the given entries. */
async function baselined(entries: SourceEntry[]): Promise<WebmentionState> {
  const net = fakeNet();
  const r = await runWebmentionSend(emptyWebmentionState(), entries, deps(net));
  expect(net.calls).toEqual([]);
  return r.state;
}

describe('first activation', () => {
  it('stores the current entries as already sent and sends nothing', async () => {
    const net = fakeNet();
    const r = await runWebmentionSend(
      emptyWebmentionState(),
      [entry('/p/a/', 'h1', ['https://other.example/x'])],
      deps(net),
    );
    expect(net.calls).toEqual([]);
    expect(r.state.initialized).toBe(true);
    expect(r.report.baselined).toBe(1);
    expect(r.state.entries[`${SITE}/p/a/`]?.hash).toBe('h1');
  });

  it('can send the existing entries on purpose', async () => {
    const net = fakeNet({
      'https://other.example/x': withEndpoint('https://other.example/wm'),
    });
    const r = await runWebmentionSend(
      emptyWebmentionState(),
      [entry('/p/a/', 'h1', ['https://other.example/x'])],
      deps(net),
      { sendExisting: true },
    );
    expect(net.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(r.report.sent).toBe(1);
  });
});

describe('new and changed entries', () => {
  it('sends source and target to the endpoint found in the Link header', async () => {
    const before = await baselined([]);
    const net = fakeNet({
      'https://other.example/x': withEndpoint('https://other.example/wm'),
    });
    const r = await runWebmentionSend(
      before,
      [entry('/p/new/', 'h1', ['https://other.example/x'])],
      deps(net),
    );
    const post = net.calls.find((c) => c.method === 'POST');
    expect(post?.url).toBe('https://other.example/wm');
    expect(new URLSearchParams(post?.body).get('source')).toBe(
      `${SITE}/p/new/`,
    );
    expect(new URLSearchParams(post?.body).get('target')).toBe(
      'https://other.example/x',
    );
    expect(r.report.sent).toBe(1);
    expect(Object.values(r.state.pairs)[0]).toMatchObject({
      status: 'sent',
      attempts: 1,
      sentAt: T0.toISOString(),
    });
  });

  it('sends nothing when the entry did not change', async () => {
    const e = entry('/p/a/', 'h1', ['https://other.example/x']);
    const before = await baselined([e]);
    const net = fakeNet();
    const r = await runWebmentionSend(before, [e], deps(net));
    expect(net.calls).toEqual([]);
    expect(r.report.sent).toBe(0);
  });

  it('sends again to all targets when the content changed, and tells a removed target', async () => {
    const before = await baselined([
      entry('/p/a/', 'h1', ['https://one.example/a', 'https://two.example/b']),
    ]);
    const net = fakeNet({
      'https://one.example/a': withEndpoint('https://one.example/wm'),
      'https://two.example/b': withEndpoint('https://two.example/wm'),
      'https://three.example/c': withEndpoint('https://three.example/wm'),
    });
    const r = await runWebmentionSend(
      before,
      [
        entry('/p/a/', 'h2', [
          'https://one.example/a',
          'https://three.example/c',
        ]),
      ],
      deps(net),
    );
    const posts = net.calls
      .filter((c) => c.method === 'POST')
      .map((c) => c.url);
    expect(posts.sort()).toEqual([
      'https://one.example/wm',
      'https://three.example/wm',
      'https://two.example/wm',
    ]);
    expect(r.report.sent).toBe(3);
  });

  it('tells the targets of an entry that is gone and forgets the entry', async () => {
    const before = await baselined([
      entry('/p/gone/', 'h1', ['https://one.example/a']),
    ]);
    const net = fakeNet({
      'https://one.example/a': withEndpoint('https://one.example/wm'),
    });
    const r = await runWebmentionSend(before, [], deps(net));
    const post = net.calls.find((c) => c.method === 'POST');
    expect(new URLSearchParams(post?.body).get('source')).toBe(
      `${SITE}/p/gone/`,
    );
    expect(r.state.entries[`${SITE}/p/gone/`]).toBeUndefined();
    // and it is not announced again in the next run
    const again = fakeNet();
    await runWebmentionSend(r.state, [], deps(again));
    expect(again.calls).toEqual([]);
  });
});

describe('which links are targets', () => {
  const run = async (links: string[], over: Partial<SendDeps> = {}) => {
    const before = await baselined([]);
    const net = fakeNet(
      Object.fromEntries(
        links.map((l) => [l, withEndpoint(new URL('/wm', l).href)]),
      ),
    );
    const r = await runWebmentionSend(
      before,
      [entry('/p/a/', 'h1', links)],
      deps(net, over),
    );
    return {
      r,
      targets: net.calls
        .filter((c) => c.method === 'POST')
        .map((c) => new URLSearchParams(c.body).get('target')),
    };
  };

  it('skips the own host, blocked hosts (also subdomains) and non-http links', async () => {
    const { targets } = await run(
      [
        `${SITE}/p/other/`,
        'https://good.example/1',
        'https://news.blocked.example/2',
        'https://blocked.example/3',
        'https://notblocked.example/4',
        'ftp://files.example/5',
        'https://user:pw@creds.example/6',
      ],
      {
        settings: {
          ...DEFAULT_SETTINGS,
          webmentionsSend: true,
          webmentionsBlock: ['blocked.example'],
        },
      },
    );
    expect(targets).toEqual([
      'https://good.example/1',
      'https://notblocked.example/4',
    ]);
  });

  it('reports only the first links up to the limit per entry', async () => {
    const links = Array.from(
      { length: 15 },
      (_, i) => `https://h${i}.example/p`,
    );
    const { targets } = await run(links, {
      settings: {
        ...DEFAULT_SETTINGS,
        webmentionsSend: true,
        webmentionsMaxTargets: 3,
      },
    });
    expect(targets).toEqual(links.slice(0, 3));
  });
});

describe('endpoint memory of hosts', () => {
  const seed = async (links: string[]) =>
    baselined([entry('/p/a/', 'h0', links)]);

  it('looks a host up once and reuses the endpoint for the next entries', async () => {
    const before = await baselined([]);
    const net = fakeNet({
      'https://h.example/1': withEndpoint('https://h.example/wm'),
      'https://h.example/2': withEndpoint('https://h.example/wm'),
    });
    await runWebmentionSend(
      before,
      [
        entry('/p/a/', 'h1', ['https://h.example/1']),
        entry('/p/b/', 'h2', ['https://h.example/2']),
      ],
      deps(net),
    );
    expect(net.calls.filter((c) => c.method === 'GET')).toHaveLength(1);
    expect(net.calls.filter((c) => c.method === 'POST')).toHaveLength(2);
  });

  it('does not ask a host without endpoint again for 30 days, then asks again', async () => {
    const before = await seed([]);
    const net = fakeNet({
      'https://plain.example/1': {
        headers: { 'content-type': 'text/html' },
        body: '<p>x</p>',
      },
    });
    const first = await runWebmentionSend(
      before,
      [entry('/p/a/', 'h1', ['https://plain.example/1'])],
      deps(net),
    );
    expect(first.report.noEndpoint).toBe(1);
    expect(net.calls.filter((c) => c.method === 'POST')).toHaveLength(0);

    const later = new Date(T0.getTime() + 29 * 86_400_000);
    const net2 = fakeNet({});
    await runWebmentionSend(
      first.state,
      [entry('/p/b/', 'h1', ['https://plain.example/2'])],
      deps(net2, { now: () => later }),
    );
    expect(net2.calls).toEqual([]);

    const muchLater = new Date(T0.getTime() + 31 * 86_400_000);
    const net3 = fakeNet({});
    await runWebmentionSend(
      first.state,
      [entry('/p/c/', 'h1', ['https://plain.example/3'])],
      deps(net3, { now: () => muchLater }),
    );
    expect(net3.calls.filter((c) => c.method === 'GET')).toHaveLength(1);
  });

  it('reuses a found endpoint for 7 days only', async () => {
    const before = await baselined([]);
    const net = fakeNet({
      'https://h.example/1': withEndpoint('https://h.example/wm'),
    });
    const first = await runWebmentionSend(
      before,
      [entry('/p/a/', 'h1', ['https://h.example/1'])],
      deps(net),
    );
    const net2 = fakeNet({
      'https://h.example/2': withEndpoint('https://h.example/wm2'),
    });
    await runWebmentionSend(
      first.state,
      [entry('/p/b/', 'h1', ['https://h.example/2'])],
      deps(net2, { now: () => new Date(T0.getTime() + 8 * 86_400_000) }),
    );
    expect(net2.calls.filter((c) => c.method === 'GET')).toHaveLength(1);
    expect(net2.calls.find((c) => c.method === 'POST')?.url).toBe(
      'https://h.example/wm2',
    );
  });

  it('does not remember a host because one of its pages is missing', async () => {
    const before = await baselined([]);
    const net = fakeNet({
      'https://h.example/gone': { status: 404, headers: {}, body: '' },
    });
    const r = await runWebmentionSend(
      before,
      [entry('/p/a/', 'h1', ['https://h.example/gone'])],
      deps(net),
    );
    expect(r.state.hosts['h.example']).toBeUndefined();
    expect(Object.values(r.state.pairs)[0]).toMatchObject({
      status: 'no-endpoint',
    });
  });

  it('treats a server error while looking for the endpoint as a failure to retry', async () => {
    const before = await baselined([]);
    const net = fakeNet({ 'https://h.example/1': { status: 503 } });
    const r = await runWebmentionSend(
      before,
      [entry('/p/a/', 'h1', ['https://h.example/1'])],
      deps(net),
    );
    expect(r.state.hosts['h.example']).toBeUndefined();
    expect(Object.values(r.state.pairs)[0]).toMatchObject({
      status: 'failed',
      attempts: 1,
    });
  });

  it('does not remember a timeout, so a short outage excludes nobody', async () => {
    const before = await baselined([]);
    const net = fakeNet({
      'https://slow.example/1': new Error('Timeout after 10000 ms'),
    });
    const r = await runWebmentionSend(
      before,
      [entry('/p/a/', 'h1', ['https://slow.example/1'])],
      deps(net),
    );
    expect(r.state.hosts['slow.example']).toBeUndefined();
    expect(Object.values(r.state.pairs)[0]).toMatchObject({
      status: 'failed',
      attempts: 1,
    });
  });
});

describe('failures and retries', () => {
  it('retries a failed pair in a later run until the attempts are used up, then gives up once', async () => {
    const before = await baselined([]);
    const e = entry('/p/a/', 'h1', ['https://h.example/1']);
    const pages = {
      'https://h.example/1': withEndpoint('https://h.example/wm'),
    };
    const failing = () => fakeNet(pages, () => ({ status: 500 }));

    let state = (await runWebmentionSend(before, [e], deps(failing()))).state;
    expect(Object.values(state.pairs)[0]).toMatchObject({
      status: 'failed',
      attempts: 1,
    });

    state = (await runWebmentionSend(state, [e], deps(failing()))).state;
    expect(Object.values(state.pairs)[0]).toMatchObject({
      status: 'failed',
      attempts: 2,
    });

    const third = await runWebmentionSend(state, [e], deps(failing()));
    expect(Object.values(third.state.pairs)[0]).toMatchObject({
      status: 'given-up',
      attempts: 3,
    });
    expect(third.report.givenUp).toEqual([
      {
        source: `${SITE}/p/a/`,
        target: 'https://h.example/1',
        error: 'HTTP 500',
      },
    ]);

    const net = fakeNet(pages);
    const fourth = await runWebmentionSend(third.state, [e], deps(net));
    expect(net.calls).toEqual([]);
    expect(fourth.report.givenUp).toEqual([]);
  });

  it('counts a later success and stops retrying', async () => {
    const before = await baselined([]);
    const e = entry('/p/a/', 'h1', ['https://h.example/1']);
    const pages = {
      'https://h.example/1': withEndpoint('https://h.example/wm'),
    };
    const first = await runWebmentionSend(
      before,
      [e],
      deps(fakeNet(pages, () => ({ status: 503 }))),
    );
    const second = await runWebmentionSend(
      first.state,
      [e],
      deps(fakeNet(pages)),
    );
    expect(Object.values(second.state.pairs)[0]).toMatchObject({
      status: 'sent',
      attempts: 2,
    });
    expect(second.report.sent).toBe(1);
  });

  it('accepts every 2xx answer of the endpoint', async () => {
    for (const status of [200, 201, 202, 204]) {
      const before = await baselined([]);
      const net = fakeNet(
        { 'https://h.example/1': withEndpoint('https://h.example/wm') },
        () => ({ status }),
      );
      const r = await runWebmentionSend(
        before,
        [entry('/p/a/', 'h1', ['https://h.example/1'])],
        deps(net),
      );
      expect(r.report.sent, String(status)).toBe(1);
    }
  });

  it('treats a refused address as a failed pair, never as a crash', async () => {
    const before = await baselined([]);
    const net = fakeNet({
      'https://evil.example/1': new Error(
        '"evil.example" is not a public address (10.0.0.1)',
      ),
    });
    const r = await runWebmentionSend(
      before,
      [entry('/p/a/', 'h1', ['https://evil.example/1'])],
      deps(net),
    );
    expect(Object.values(r.state.pairs)[0]).toMatchObject({ status: 'failed' });
    expect(Object.values(r.state.pairs)[0]?.error).toMatch(
      /not a public address/,
    );
  });
});

describe('pace', () => {
  it('pauses between requests to foreign servers and not after the last one', async () => {
    const before = await baselined([]);
    const pages = {
      'https://a.example/1': withEndpoint('https://a.example/wm'),
      'https://b.example/1': withEndpoint('https://b.example/wm'),
    };
    const net = fakeNet(pages);
    const d = deps(net);
    await runWebmentionSend(
      before,
      [entry('/p/a/', 'h1', ['https://a.example/1', 'https://b.example/1'])],
      d,
    );
    // 2 lookups + 2 posts = 4 requests, 3 pauses of the configured length
    expect(d.sleeps).toEqual([1000, 1000, 1000]);
  });
});

describe('state', () => {
  it('does not change the state it was given', async () => {
    const before = await baselined([]);
    const copy = JSON.stringify(before);
    const net = fakeNet({
      'https://h.example/1': withEndpoint('https://h.example/wm'),
    });
    await runWebmentionSend(
      before,
      [entry('/p/a/', 'h1', ['https://h.example/1'])],
      deps(net),
    );
    expect(JSON.stringify(before)).toBe(copy);
  });

  it('can be written as JSON and read again', async () => {
    const before = await baselined([]);
    const net = fakeNet({
      'https://h.example/1': withEndpoint('https://h.example/wm'),
    });
    const r = await runWebmentionSend(
      before,
      [entry('/p/a/', 'h1', ['https://h.example/1'])],
      deps(net),
    );
    expect(JSON.parse(JSON.stringify(r.state))).toEqual(r.state);
  });
});

describe('guards', () => {
  it('refuses to run without a site address', async () => {
    const net = fakeNet();
    await expect(
      runWebmentionSend(emptyWebmentionState(), [], deps(net, { siteUrl: '' })),
    ).rejects.toThrow(/SITE_URL/);
  });
});
