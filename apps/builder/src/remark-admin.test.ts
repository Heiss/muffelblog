import { describe, expect, it } from 'vitest';
import { createAdminClient, formatComment } from './remark-admin.ts';

function fake(
  answer: unknown = {},
  status = 200,
  raw?: Uint8Array<ArrayBuffer>,
) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const doFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: new URL(url), init });
    return new Response(raw ? new Blob([raw]) : JSON.stringify(answer), {
      status,
    });
  }) as unknown as typeof fetch;
  return { calls, doFetch };
}

const client = (doFetch: typeof fetch) =>
  createAdminClient({
    baseUrl: 'http://remark42:8080/',
    site: 'muffelblog',
    password: 'geheim',
    fetch: doFetch,
  });

const authHeader = (init: RequestInit) =>
  (init.headers as Record<string, string>).Authorization;

describe('createAdminClient', () => {
  it('logs in with the admin basic auth on every request', async () => {
    const { calls, doFetch } = fake([]);
    await client(doFetch).list(5);
    expect(authHeader(calls[0]?.init as RequestInit)).toBe(
      `Basic ${Buffer.from('admin:geheim').toString('base64')}`,
    );
  });

  it('lists the latest comments', async () => {
    const { calls, doFetch } = fake([
      {
        id: 'a',
        text: '<p>Hallo</p>',
        user: { name: 'Anna', id: 'email_1' },
        time: '2026-11-04T10:00:00Z',
        locator: { url: 'https://b.example/p/x/' },
      },
    ]);
    const list = await client(doFetch).list(5);
    expect(calls[0]?.url.pathname).toBe('/api/v1/last/5');
    expect(calls[0]?.url.searchParams.get('site')).toBe('muffelblog');
    expect(list).toHaveLength(1);
  });

  it('deletes a comment by id and page address', async () => {
    const { calls, doFetch } = fake({});
    await client(doFetch).deleteComment('c1', 'https://b.example/p/x/');
    expect(calls[0]?.init.method).toBe('DELETE');
    expect(calls[0]?.url.pathname).toBe('/api/v1/admin/comment/c1');
    expect(calls[0]?.url.searchParams.get('url')).toBe(
      'https://b.example/p/x/',
    );
  });

  it('blocks and unblocks a user, optionally for a time', async () => {
    const { calls, doFetch } = fake({});
    const c = client(doFetch);
    await c.block('email_1', '7d');
    await c.unblock('email_1');
    expect(calls[0]?.init.method).toBe('PUT');
    expect(calls[0]?.url.pathname).toBe('/api/v1/admin/user/email_1');
    expect(calls[0]?.url.searchParams.get('block')).toBe('1');
    expect(calls[0]?.url.searchParams.get('ttl')).toBe('7d');
    expect(calls[1]?.url.searchParams.get('block')).toBe('0');
    expect(calls[1]?.url.searchParams.has('ttl')).toBe(false);
  });

  it('exports all comments as a file and returns the bytes unchanged', async () => {
    const bytes = new Uint8Array([0x1f, 0x8b, 8, 0, 255, 0]);
    const { calls, doFetch } = fake(undefined, 200, bytes);
    const out = await client(doFetch).exportAll();
    expect(calls[0]?.url.pathname).toBe('/api/v1/admin/export');
    expect(calls[0]?.url.searchParams.get('mode')).toBe('file');
    expect([...out]).toEqual([...bytes]);
  });

  it('imports a backup and waits for the import to finish', async () => {
    const { calls, doFetch } = fake({});
    await client(doFetch).importAll(new Uint8Array([1, 2, 3]));
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.url.pathname).toBe('/api/v1/admin/import');
    expect(calls[1]?.url.pathname).toBe('/api/v1/admin/wait');
  });

  it('stops with a clear message when Remark42 refuses, and never prints the password', async () => {
    const { doFetch } = fake({ error: 'nope' }, 403);
    const error = await client(doFetch)
      .list(1)
      .catch((e: Error) => e);
    expect(String(error)).toMatch(/403/);
    expect(String(error)).not.toContain('geheim');
  });

  it('refuses to start without a password or with a wrong address', () => {
    expect(() =>
      createAdminClient({ baseUrl: 'http://x', site: 's', password: '' }),
    ).toThrow(/REMARK_ADMIN_PASSWD/);
    expect(() =>
      createAdminClient({ baseUrl: 'nonsense', site: 's', password: 'p' }),
    ).toThrow(/REMARK_INTERNAL_URL/);
  });
});

describe('formatComment', () => {
  it('shows id, time, author, page and a short plain text', () => {
    const line = formatComment({
      id: 'abc',
      text: '<p>Ein <b>langer</b> Kommentar &amp; mehr</p>',
      user: { name: 'Anna', id: 'email_42' },
      time: '2026-11-04T10:00:00Z',
      locator: { url: 'https://b.example/p/x/' },
    });
    expect(line).toContain('abc');
    expect(line).toContain('Anna');
    expect(line).toContain('email_42');
    expect(line).toContain('https://b.example/p/x/');
    expect(line).toContain('Ein langer Kommentar & mehr');
    expect(line).not.toContain('<b>');
  });

  it('cuts long texts', () => {
    const line = formatComment({
      id: 'a',
      text: 'x'.repeat(500),
      user: { name: 'N', id: 'i' },
      time: '2026-11-04T10:00:00Z',
      locator: { url: 'u' },
    });
    expect(line.length).toBeLessThan(300);
  });
});
