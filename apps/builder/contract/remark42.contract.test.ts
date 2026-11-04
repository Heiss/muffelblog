import { describe, expect, it } from 'vitest';
import {
  commentsFingerprint,
  createRemarkSource,
  toTree,
} from '@muffelblog/core';

// Contract test against a real Remark42 (CI job "Contract tests"). It runs only
// if REMARK42_CONTRACT_URL is set. Comments are written with the admin login
// (basic auth), as the builder never does, only to have something to read.
const URL_ = process.env.REMARK42_CONTRACT_URL;
const SITE = 'contract';
const PASSWORD = process.env.REMARK42_CONTRACT_ADMIN_PASSWD ?? '';
const auth = `Basic ${Buffer.from(`admin:${PASSWORD}`).toString('base64')}`;
const PAGE = 'https://blog.example/p/kontrakt/';

async function post(body: unknown): Promise<{ id: string }> {
  // Remark42 limits how fast one user may write (429), so wait and try again.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const res = await fetch(`${URL_}/api/v1/comment`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    expect(res.status, await res.clone().text()).toBe(201);
    return (await res.json()) as { id: string };
  }
  throw new Error('Remark42 kept answering 429');
}

async function waitUntilUp(): Promise<void> {
  const until = Date.now() + 90_000;
  for (;;) {
    try {
      if ((await fetch(`${URL_}/ping`)).ok) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() > until) throw new Error('Remark42 did not come up');
    await new Promise((r) => setTimeout(r, 2000));
  }
}

describe.skipIf(!URL_)('Remark42 public API', () => {
  it('returns the comments of a page and of the site, and a fingerprint that follows changes', async () => {
    await waitUntilUp();
    const source = createRemarkSource({ baseUrl: URL_ as string, site: SITE });

    // A page without comments is an empty list, not an error.
    expect((await source.find(PAGE)).comments).toEqual([]);

    const locator = { site: SITE, url: PAGE };
    const first = await post({ text: 'Erster **Kommentar**', locator });
    const reply = await post({ text: 'Antwort', locator, pid: first.id });

    const found = (await source.find(PAGE)).comments;
    expect(found.map((c) => c.id).sort()).toEqual([first.id, reply.id].sort());
    const tree = await toTree(found);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.html).toContain('<strong>Kommentar</strong>');
    expect(tree[0]?.replies.map((n) => n.id)).toEqual([reply.id]);
    expect(tree[0]?.author).toBe('admin');

    // Another page does not see them.
    expect(
      (await source.find('https://blog.example/p/anders/')).comments,
    ).toEqual([]);

    const before = commentsFingerprint((await source.last(100)).comments);
    await post({ text: 'Noch einer', locator });
    const after = commentsFingerprint((await source.last(100)).comments);
    expect(after).not.toBe(before);
  });
});
