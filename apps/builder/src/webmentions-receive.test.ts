import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AdminComment } from './remark-admin.ts';
import {
  createReceiveRunner,
  recoverFromComments,
  type ReceiveAdmin,
} from './webmentions-receive.ts';

const SITE = 'https://blog.example.org';
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'wm-receive-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const mention = (id: number, source = `https://s${id}.example/post`) => ({
  type: 'entry',
  author: { type: 'card', name: `Author ${id}` },
  'wm-id': id,
  'wm-source': source,
  'wm-target': `${SITE}/p/hallo-welt/`,
  'wm-property': 'mention-of',
});

function fakeApi(mentions: unknown[], deleted: unknown[] = []) {
  const urls: URL[] = [];
  const headers: Headers[] = [];
  const doFetch = (async (url: string, init: RequestInit) => {
    const u = new URL(url);
    urls.push(u);
    headers.push(new Headers(init.headers));
    if (u.pathname === '/api/mentions.jf2') {
      const since = Number(u.searchParams.get('since_id') ?? 0);
      return Response.json({
        type: 'feed',
        children: mentions.filter(
          (m) => (m as { 'wm-id': number })['wm-id'] > since,
        ),
      });
    }
    if (u.pathname === '/api/deleted') return Response.json(deleted);
    return new Response('not found', { status: 404 });
  }) as unknown as typeof fetch;
  return { urls, headers, doFetch };
}

function fakeAdmin(existing: AdminComment[] = []) {
  const posted: { text: string; page: string }[] = [];
  const deleted: string[] = [];
  const admin: ReceiveAdmin = {
    list: async () => existing,
    postComment: async (text, page) => {
      posted.push({ text, page });
      return `c${posted.length}`;
    },
    deleteComment: async (id) => {
      deleted.push(id);
    },
  };
  return { admin, posted, deleted };
}

const runner = (doFetch: typeof fetch, admin: ReceiveAdmin) =>
  createReceiveRunner({
    stateDir: dir,
    siteUrl: SITE,
    apiUrl: 'http://webmention-io:8090/',
    token: 'secret-token',
    lang: 'en',
    admin,
    log: () => {},
    timeoutMs: 1000,
    maxBytes: 1_000_000,
    fetch: doFetch,
  });

describe('createReceiveRunner', () => {
  it('posts new mentions as comments of the administrator on their page', async () => {
    const api = fakeApi([mention(1), mention(2)]);
    const a = fakeAdmin();
    expect(await runner(api.doFetch, a.admin).run()).toEqual({
      posted: 2,
      removed: 0,
    });
    expect(a.posted[0]).toEqual({
      text: 'Mention from Author 1: [https://s1.example/post](https://s1.example/post)',
      page: `${SITE}/p/hallo-welt/`,
    });
  });

  it('sends the token as a bearer header', async () => {
    const api = fakeApi([]);
    await runner(api.doFetch, fakeAdmin().admin).run();
    expect(api.headers[0]?.get('authorization')).toBe('Bearer secret-token');
  });

  it('does not post twice and asks only for newer mentions next time', async () => {
    const api = fakeApi([mention(1)]);
    const a = fakeAdmin();
    await runner(api.doFetch, a.admin).run();
    await runner(api.doFetch, a.admin).run();
    expect(a.posted).toHaveLength(1);
    const last = api.urls
      .filter((u) => u.pathname === '/api/mentions.jf2')
      .at(-1);
    expect(last?.searchParams.get('since_id')).toBe('1');
  });

  it('removes the comment of a mention that was deleted at webmention.io', async () => {
    const a = fakeAdmin();
    await runner(fakeApi([mention(1)]).doFetch, a.admin).run();
    const api = fakeApi(
      [mention(1)],
      [
        {
          'wm-id': 1,
          'wm-source': 'https://s1.example/post',
          'wm-target': `${SITE}/p/hallo-welt/`,
        },
      ],
    );
    expect((await runner(api.doFetch, a.admin).run()).removed).toBe(1);
    expect(a.deleted).toEqual(['c1']);
    const state = JSON.parse(
      await readFile(path.join(dir, 'webmentions-received.json'), 'utf8'),
    ) as { posted: object };
    expect(state.posted).toEqual({});
  });

  it('after a lost state, finds the posted mentions in Remark42 and posts nothing twice (O3)', async () => {
    const existing: AdminComment[] = [
      {
        id: 'old',
        text: '<p>Mention from Author 1: <a href="https://s1.example/post">https://s1.example/post</a></p>',
        user: { name: 'admin', id: 'admin' },
        time: '2026-11-05T10:00:00Z',
        locator: { url: `${SITE}/p/hallo-welt/` },
      },
    ];
    const a = fakeAdmin(existing);
    await runner(fakeApi([mention(1), mention(2)]).doFetch, a.admin).run();
    expect(a.posted.map((p) => p.text)).toEqual([
      'Mention from Author 2: [https://s2.example/post](https://s2.example/post)',
    ]);
  });

  it('treats a damaged state file like a lost one', async () => {
    await writeFile(path.join(dir, 'webmentions-received.json'), '{nonsense');
    const a = fakeAdmin();
    await runner(fakeApi([mention(1)]).doFetch, a.admin).run();
    expect(a.posted).toHaveLength(1);
  });

  it('reports an error answer of webmention.io without the token', async () => {
    const doFetch = (async () =>
      new Response('no', { status: 401 })) as unknown as typeof fetch;
    const error = await runner(doFetch, fakeAdmin().admin)
      .run()
      .catch((e: unknown) => e as Error);
    expect(String(error)).toMatch(/401/);
    expect(String(error)).not.toContain('secret-token');
  });
});

describe('recoverFromComments', () => {
  it('ignores comments of visitors, so nobody can hide a mention', () => {
    const state = recoverFromComments([
      {
        id: 'v',
        text: '<p><a href="https://s1.example/post">x</a></p>',
        user: { name: 'Eve', id: 'email_1' },
        time: '',
        locator: { url: `${SITE}/p/hallo-welt/` },
      },
    ]);
    expect(state.posted).toEqual({});
  });
});
