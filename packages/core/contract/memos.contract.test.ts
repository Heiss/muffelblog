import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildMemoEntries, createHttpMemosSource } from '../src/memos.ts';

/**
 * Contract test against a real Memos instance (fresh, without data).
 * Runs only with MEMOS_CONTRACT_URL, for example http://localhost:5230.
 * It creates the first user, sets the access mode to PUBLIC, creates memos
 * and checks that the loader reads them correctly without login.
 */
const BASE = process.env.MEMOS_CONTRACT_URL;
const PASSWORD = 'contract-test-password-123';

async function request(
  requestPath: string,
  options: { method?: string; body?: unknown; token?: string } = {},
): Promise<{ status: number; json: Record<string, unknown>; text: string }> {
  const response = await fetch(`${BASE}${requestPath}`, {
    method: options.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // Response without JSON, the text is in the error message.
  }
  return { status: response.status, json, text };
}

function expectOk(
  response: { status: number; text: string },
  what: string,
): void {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `${what}: HTTP ${response.status}, response: ${response.text.slice(0, 500)}`,
    );
  }
}

async function waitForInstance(): Promise<void> {
  const deadline = Date.now() + 120_000;
  let last = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/healthz`);
      if (response.ok) return;
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((done) => setTimeout(done, 2000));
  }
  throw new Error(`Memos did not become ready (${last})`);
}

describe.skipIf(!BASE)('Memos (real instance)', () => {
  let publicUid = '';
  let attachmentName = '';

  beforeAll(async () => {
    await waitForInstance();

    const created = await request('/api/users', {
      method: 'POST',
      body: { username: 'ci', password: PASSWORD, displayName: 'CI' },
    });
    // If the test runs again against the same instance, the user already exists.
    if (created.status < 200 || created.status >= 300)
      console.warn(
        `Create user: HTTP ${created.status} ${created.text.slice(0, 200)}`,
      );

    const login = await request('/api/auth/signin', {
      method: 'POST',
      body: { passwordCredentials: { username: 'ci', password: PASSWORD } },
    });
    expectOk(login, 'Sign in');
    const token = String(login.json.accessToken ?? '');
    expect(token).not.toBe('');

    const mode = await request('/api/instance/settings/ACCESS', {
      method: 'PATCH',
      token,
      body: {
        name: 'instance/settings/ACCESS',
        accessSetting: { accessMode: 'INSTANCE_ACCESS_MODE_PUBLIC' },
      },
    });
    expectOk(mode, 'Set access mode to PUBLIC');

    const image = await sharp({
      create: {
        width: 640,
        height: 320,
        channels: 3,
        background: { r: 30, g: 120, b: 200 },
      },
    })
      .png()
      .toBuffer();
    const attachment = await request('/api/attachments', {
      method: 'POST',
      token,
      body: {
        filename: 'IMG_CI.png',
        type: 'image/png',
        content: image.toString('base64'),
      },
    });
    expectOk(attachment, 'Upload attachment');
    attachmentName = String(attachment.json.name ?? '');
    expect(attachmentName).toMatch(/^attachments\//);

    const publicMemo = await request('/api/memos', {
      method: 'POST',
      token,
      body: {
        content: 'Contract test: public memo #contract #a/b',
        visibility: 'PUBLIC',
        attachments: [{ name: attachmentName }],
      },
    });
    expectOk(publicMemo, 'Create public memo');
    publicUid = String(publicMemo.json.name ?? '').replace(/^memos\//, '');
    expect(publicUid).not.toBe('');

    for (const visibility of ['PRIVATE', 'PROTECTED']) {
      const memo = await request('/api/memos', {
        method: 'POST',
        token,
        body: {
          content: `Contract test: ${visibility} must never appear`,
          visibility: visibility,
        },
      });
      expectOk(memo, `Create ${visibility} memo`);
    }
  }, 180_000);

  it('returns the list without login as JSON with the expected field names', async () => {
    const url = new URL(`${BASE}/api/memos`);
    url.searchParams.set('page_size', '100');
    url.searchParams.set('filter', 'visibility == "PUBLIC"');
    url.searchParams.set('order_by', 'create_time desc');
    const response = await fetch(url);
    expect(response.status).toBe(200);
    const json = (await response.json()) as Record<string, unknown>;
    expect(Array.isArray(json.memos)).toBe(true);
    expect(typeof json.nextPageToken).toBe('string');
    const memo = (json.memos as Array<Record<string, unknown>>)[0] ?? {};
    for (const field of [
      'name',
      'content',
      'visibility',
      'createTime',
      'attachments',
      'tags',
    ]) {
      expect(Object.keys(memo), `field ${field}`).toContain(field);
    }
  });

  it('the loader sees only the public memo with attachment and tags', async () => {
    const source = createHttpMemosSource({ baseUrl: BASE as string });
    const { memos, warnings } = await source.listPublicMemos();
    expect(warnings).toEqual([]);
    expect(memos.map((m) => m.name)).toEqual([`memos/${publicUid}`]);
    const memo = memos[0];
    expect(memo?.visibility).toBe('PUBLIC');
    expect(memo?.content).toContain('public memo');
    expect(memo?.tags).toContain('contract');
    // Proven: Memos also returns the parent tag "a" for "#a/b".
    expect(memo?.tags).toEqual(
      expect.arrayContaining(['contract', 'a', 'a/b']),
    );
    expect(memo?.attachments?.map((a) => a.filename)).toEqual(['IMG_CI.png']);
    expect(memo?.attachments?.[0]?.name).toBe(attachmentName);
  });

  it('the loader loads the attachment without login through the file route', async () => {
    const source = createHttpMemosSource({ baseUrl: BASE as string });
    const { memos } = await source.listPublicMemos();
    const attachment = memos[0]?.attachments?.[0];
    expect(attachment).toBeDefined();
    const fetched = await source.fetchAttachment(
      attachment as NonNullable<typeof attachment>,
      5_000_000,
    );
    expect(fetched).toMatchObject({ ok: true });
    if (!fetched.ok) return;
    expect((await sharp(fetched.data).metadata()).format).toBe('png');
  });

  it('builds a page from it without a link to the instance', async () => {
    const source = createHttpMemosSource({ baseUrl: BASE as string });
    const store = new Map<string, Buffer>();
    const { memos, warnings } = await buildMemoEntries(source, store);
    expect(warnings).toEqual([]);
    expect(memos).toHaveLength(1);
    const html = memos[0]?.html ?? '';
    expect(memos[0]?.tags).toEqual(['contract', 'a/b']);
    expect(html).toContain('public memo');
    expect(html).toMatch(/<img [^>]*alt="IMG CI"/);
    expect(html).not.toContain(String(BASE));
    expect(html).not.toContain('/file/attachments');
    expect(store.size).toBeGreaterThan(0);
  });

  it('reports an error instead of an empty list if the instance is unreachable', async () => {
    const source = createHttpMemosSource({
      baseUrl: 'http://127.0.0.1:9',
      timeoutMs: 3000,
    });
    await expect(source.listPublicMemos()).rejects.toThrow();
  });
});
