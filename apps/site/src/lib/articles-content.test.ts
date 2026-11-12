import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { MemosSource } from '@muffelblog/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// getContent and getGraph read the content once per build; every test loads
// fresh modules on a folder of its own.

const state = vi.hoisted(() => ({ dir: '', memos: undefined as unknown }));

vi.mock('./content', () => ({
  contentConfig: () => ({ contentDir: state.dir, memos: state.memos }),
}));

const memoSource = (list: unknown[]): MemosSource => ({
  listPublicMemos: async () => ({
    memos: list as never,
    warnings: ['memo list'],
  }),
  fetchAttachment: async () => ({ ok: false, code: 'not-found', reason: 'x' }),
});

const put = async (file: string, text: string) => {
  await mkdir(path.dirname(path.join(state.dir, file)), { recursive: true });
  await writeFile(path.join(state.dir, file), text);
};
const doc = (front: string, body: string) =>
  `---\npublish: true\ncreated: 2026-01-01\nupdated: 2026-01-01\n${front}\n---\n${body}`;

beforeEach(async () => {
  vi.resetModules();
  state.dir = await mkdtemp(path.join(os.tmpdir(), 'site-content-'));
  state.memos = memoSource([
    {
      name: 'memos/m1',
      content: 'Memo with [a link](https://ext.example/x)',
      visibility: 'PUBLIC',
      createTime: '2026-01-02T10:00:00Z',
      tags: [],
      attachments: [],
    },
  ]);
  vi.stubEnv('SITE_URL', 'https://blog.example');
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await rm(state.dir, { recursive: true, force: true });
});

describe('getContent', () => {
  it('renders articles with links to the pages of posts, terms and pages', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await put(
      'a.md',
      doc('', '[post](b.md) [term](t.md) [page](about.md) [gone](x.md)'),
    );
    await put('b.md', doc('', 'B'));
    await put('t.md', doc('type: glossary', 'T'));
    await put('about.md', doc('type: page', 'P'));
    const { getContent } = await import('./articles');
    const first = getContent();
    expect(getContent()).toBe(first);
    const { articles, memos, media } = await first;
    const a = articles.find((x) => x.path === 'a.md');
    expect(a?.html).toBe(
      '<p><a href="/p/b/">post</a> <a href="/g/t/">term</a> <a href="/about/">page</a> gone</p>',
    );
    expect(memos.map((m) => m.uid)).toEqual(['m1']);
    expect(media.size).toBe(0);
    expect(warn.mock.calls).toEqual([
      [
        '[content] a.md: link to "x.md" leads to no published file and is shown as text',
      ],
      ['[content] memo list'],
    ]);
  });
});

describe('getGraph', () => {
  it('links posts, terms and memos, without static pages', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await put('a.md', doc('', '[term](t.md) [about](about.md)'));
    await put('t.md', doc('type: glossary\nterm: Term', 'T'));
    await put('about.md', doc('type: page', '[a](a.md)'));
    const { getGraph } = await import('./graph');
    const graph = await getGraph();
    expect(JSON.stringify(graph)).not.toContain('/about/');
    const byId = Object.fromEntries(
      graph.nodes.map((n) => [n.id, [n.kind, n.title]]),
    );
    expect(byId['/p/a/']).toEqual(['post', 'a']);
    expect(byId['/g/t/']).toEqual(['glossary', 'Term']);
    expect(byId['/m/m1/']?.[0]).toBe('memo');
    expect(byId['domain:ext.example']?.[0]).toBe('domain');
    expect(graph.edges).toContainEqual({ from: '/p/a/', to: '/g/t/' });
    expect(await getGraph()).toBe(graph);
  });
});
