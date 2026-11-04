import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_SETTINGS, type SafeResponse } from '@muffelblog/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AlertEvent } from './scheduler.ts';
import {
  createWebmentionRunner,
  loadState,
  scanRelease,
  summarize,
} from './webmentions.ts';

const SITE = 'https://blog.example';
let root: string;
let releases: string;
let stateDir: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'wm-'));
  releases = path.join(root, 'releases');
  stateDir = path.join(root, 'state');
  await mkdir(path.join(releases, 'r1'), { recursive: true });
  await symlink('r1', path.join(releases, 'current'));
});
afterEach(() => rm(root, { recursive: true, force: true }));

const page = (content: string) =>
  `<!doctype html><html><body><article class="h-entry"><div class="content e-content">${content}</div></article></body></html>`;

async function writePage(folder: string, name: string, html: string) {
  const dir = path.join(releases, 'r1', folder, name);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), html);
}

describe('scanRelease', () => {
  it('reads posts, memos and terms, and nothing else', async () => {
    await writePage('p', 'post', page('<a href="https://a.example/1">a</a>'));
    await writePage('m', 'memo1', page('<a href="https://b.example/2">b</a>'));
    await writePage('g', 'cache', page('<a href="https://c.example/3">c</a>'));
    await writePage('tag', 'x', page('<a href="https://d.example/4">d</a>'));
    await writePage(
      'impressum',
      '',
      page('<a href="https://e.example/5">e</a>'),
    );
    const entries = await scanRelease(
      path.join(releases, 'current'),
      `${SITE}/ignored/path`,
    );
    expect(entries.map((e) => [e.source, e.links])).toEqual([
      [`${SITE}/p/post/`, ['https://a.example/1']],
      [`${SITE}/m/memo1/`, ['https://b.example/2']],
      [`${SITE}/g/cache/`, ['https://c.example/3']],
    ]);
  });

  it('skips list pages without an entry, and works without any folder', async () => {
    await writePage('p', 'list', '<html><body><p>no entry</p></body></html>');
    expect(await scanRelease(path.join(releases, 'current'), SITE)).toEqual([]);
    expect(await scanRelease(path.join(root, 'empty'), SITE)).toEqual([]);
  });
});

describe('loadState', () => {
  it('starts empty without a file, and treats a damaged file as a first start', async () => {
    const logs: string[] = [];
    const file = path.join(stateDir, 'webmentions.json');
    expect((await loadState(file, (l) => logs.push(l))).initialized).toBe(
      false,
    );
    await mkdir(stateDir, { recursive: true });
    await writeFile(file, '{ not json');
    const state = await loadState(file, (l) => logs.push(l));
    expect(state.initialized).toBe(false);
    expect(logs.join()).toMatch(/damaged/);
  });
});

describe('createWebmentionRunner', () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    webmentionsSend: true,
    webmentionsDelayMs: 0,
  };

  function runner(
    over: {
      fetch?: (
        u: string,
        i: { method?: string; body?: string },
      ) => Promise<Partial<SafeResponse>>;
    } = {},
  ) {
    const posts: string[] = [];
    const alerts: AlertEvent[] = [];
    const summaries: unknown[] = [];
    const logs: string[] = [];
    const r = createWebmentionRunner({
      releasesDir: releases,
      stateDir,
      settings,
      siteUrl: SITE,
      alert: async (e) => void alerts.push(e),
      onSummary: (s) => void summaries.push(s),
      log: (l) => void logs.push(l),
      deps: {
        sleep: async () => {},
        fetch: async (url, init) => {
          if (init.method === 'POST') posts.push(`${url} ${init.body}`);
          const answer = over.fetch
            ? await over.fetch(url, init)
            : init.method === 'POST'
              ? { status: 202 }
              : {
                  headers: { link: '<https://a.example/wm>; rel="webmention"' },
                };
          return {
            status: 200,
            url,
            headers: {},
            body: '',
            truncated: false,
            ...answer,
          };
        },
      },
    });
    return { r, posts, alerts, summaries, logs };
  }

  it('stores the existing entries at the first run without sending, then sends a new one', async () => {
    await writePage('p', 'old', page('<a href="https://a.example/1">a</a>'));
    const x = runner();
    await x.r.run();
    expect(x.posts).toEqual([]);
    expect(x.logs.join('\n')).toMatch(/first start, 1 existing entries/);

    await writePage('p', 'new', page('<a href="https://a.example/2">b</a>'));
    await x.r.run();
    expect(x.posts).toHaveLength(1);
    expect(x.posts[0]).toContain('https://a.example/wm');
    expect(decodeURIComponent(x.posts[0] as string)).toContain(
      `source=${SITE}/p/new/`,
    );

    const saved = JSON.parse(
      await readFile(path.join(stateDir, 'webmentions.json'), 'utf8'),
    );
    expect(saved.initialized).toBe(true);
    expect(Object.values(saved.pairs)).toHaveLength(1);
    expect(x.summaries.at(-1)).toMatchObject({
      sent: 1,
      failed: 0,
      givenUp: 0,
    });
  });

  it('keeps the state across a new runner (a restart of the builder)', async () => {
    await writePage('p', 'old', page('<a href="https://a.example/1">a</a>'));
    await runner().r.run();
    const second = runner();
    await second.r.run();
    expect(second.posts).toEqual([]);
  });

  it('can send the existing entries on purpose', async () => {
    await writePage('p', 'old', page('<a href="https://a.example/1">a</a>'));
    const x = runner();
    await x.r.run({ sendExisting: true });
    expect(x.posts).toHaveLength(1);
  });

  it('alerts once when a pair is given up, and never throws', async () => {
    await writePage('p', 'old', page('<a href="https://a.example/1">a</a>'));
    const x = runner({
      fetch: async (_u, init) =>
        init.method === 'POST'
          ? { status: 500 }
          : { headers: { link: '<https://a.example/wm>; rel="webmention"' } },
    });
    await x.r.run(); // baseline
    await writePage('p', 'new', page('<a href="https://a.example/2">b</a>'));
    for (let i = 0; i < 3; i += 1) await x.r.run();
    expect(x.alerts).toHaveLength(1);
    expect(x.alerts[0]).toMatchObject({ kind: 'webmention' });
    expect(x.alerts[0]?.message).toContain('https://a.example/2');
    await x.r.run();
    expect(x.alerts).toHaveLength(1);
  });

  it('logs a failure of the run instead of throwing', async () => {
    const x = runner();
    await rm(path.join(releases, 'current'));
    await expect(x.r.run()).resolves.toBeUndefined();
  });

  it('runs one at a time and repeats once if asked again meanwhile', async () => {
    await writePage('p', 'old', page('<a href="https://a.example/1">a</a>'));
    let open = 0;
    let most = 0;
    const x = runner({
      fetch: async () => {
        open += 1;
        most = Math.max(most, open);
        await new Promise((r) => setTimeout(r, 20));
        open -= 1;
        return {
          headers: { link: '<https://a.example/wm>; rel="webmention"' },
        };
      },
    });
    await x.r.run();
    await writePage('p', 'new', page('<a href="https://a.example/2">b</a>'));
    await Promise.all([x.r.run(), x.r.run(), x.r.run()]);
    expect(most).toBe(1);
  });
});

describe('summarize', () => {
  it('counts the pairs by status', () => {
    const s = summarize(
      {
        version: 1,
        initialized: true,
        hosts: {},
        entries: {},
        pairs: {
          a: {
            source: 's',
            target: 't1',
            status: 'sent',
            reason: 'new',
            attempts: 1,
            lastAttemptAt: '',
          },
          b: {
            source: 's',
            target: 't2',
            status: 'failed',
            reason: 'new',
            attempts: 1,
            lastAttemptAt: '',
          },
          c: {
            source: 's',
            target: 't3',
            status: 'given-up',
            reason: 'new',
            attempts: 3,
            lastAttemptAt: '',
          },
          d: {
            source: 's',
            target: 't4',
            status: 'no-endpoint',
            reason: 'new',
            attempts: 0,
            lastAttemptAt: '',
          },
        },
      },
      new Date('2026-11-04T12:00:00Z'),
    );
    expect(s).toEqual({
      lastRun: '2026-11-04T12:00:00.000Z',
      sent: 1,
      failed: 1,
      givenUp: 1,
      noEndpoint: 1,
    });
  });
});

describe('end to end with a real receiver', () => {
  let server: Server | undefined;
  afterEach(() => server?.close());

  async function receiver() {
    const got: string[] = [];
    server = createServer((req, res) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          got.push(body);
          res.statusCode = 202;
          res.end();
        });
        return;
      }
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Link', '</webmention>; rel="webmention"');
      res.end('<p>receiver</p>');
    });
    await new Promise<void>((r) => server?.listen(0, '127.0.0.1', r));
    return {
      got,
      base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    };
  }

  const make = (allowPrivate: boolean) => {
    const logs: string[] = [];
    const r = createWebmentionRunner({
      releasesDir: releases,
      stateDir,
      settings: {
        ...DEFAULT_SETTINGS,
        webmentionsSend: true,
        webmentionsAllowPrivate: allowPrivate,
        webmentionsDelayMs: 0,
        webmentionsTimeoutMs: 2000,
      },
      siteUrl: SITE,
      alert: async () => {},
      onSummary: () => {},
      log: (l) => void logs.push(l),
    });
    return { r, logs };
  };

  it('sends the message over a real connection when the address check is lifted', async () => {
    const { got, base } = await receiver();
    const x = make(true);
    await x.r.run(); // first start: nothing
    await writePage(
      'p',
      'hello',
      page(`<p><a href="${base}/target">link</a></p>`),
    );
    await x.r.run();
    expect(got).toHaveLength(1);
    const form = new URLSearchParams(got[0]);
    expect(form.get('source')).toBe(`${SITE}/p/hello/`);
    expect(form.get('target')).toBe(`${base}/target`);
  });

  it('refuses the same local receiver by default and marks the pair as failed', async () => {
    const { got, base } = await receiver();
    const x = make(false);
    await x.r.run();
    await writePage(
      'p',
      'hello',
      page(`<p><a href="${base}/target">link</a></p>`),
    );
    await x.r.run();
    expect(got).toEqual([]);
    const saved = JSON.parse(
      await readFile(path.join(stateDir, 'webmentions.json'), 'utf8'),
    );
    const pair = Object.values(saved.pairs)[0] as {
      status: string;
      error: string;
    };
    expect(pair.status).toBe('failed');
    expect(pair.error).toMatch(/not a public address/);
  });
});
