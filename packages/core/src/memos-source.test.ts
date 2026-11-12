import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MemosError,
  buildMemoEntries,
  createFixtureMemosSource,
  createHttpMemosSource,
  memosFingerprint,
  type MemoAttachmentRaw,
  type MemoRaw,
  type MemosSource,
} from './memos.ts';

// Exact checks of what the Memos sources read and answer, entry by entry.

const BASE = 'http://memos.test:5230';

const json = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status: 200,
    ...init,
  });

const page = (memos: unknown[], nextPageToken: unknown = '') =>
  json({ memos, nextPageToken });

async function listOf(memos: unknown[]) {
  const source = createHttpMemosSource({
    baseUrl: BASE,
    fetch: async () => page(memos),
  });
  return source.listPublicMemos();
}

const memo = (extra: Record<string, unknown> = {}) => ({
  name: 'memos/a1',
  content: 'Text',
  ...extra,
});

describe('MemosError', () => {
  it('carries its own name', () => {
    expect(new MemosError('x').name).toBe('MemosError');
  });
});

describe('reading one memo of the list', () => {
  it('keeps the fields and fills missing text fields with empty text', async () => {
    const { memos, warnings } = await listOf([memo()]);
    expect(warnings).toEqual([]);
    expect(memos).toEqual([
      {
        name: 'memos/a1',
        content: 'Text',
        visibility: '',
        createTime: '',
        tags: [],
        attachments: [],
      },
    ]);
  });

  it('takes state and parent only when they are text', async () => {
    const { memos } = await listOf([
      memo({ state: 'ARCHIVED', parent: 'memos/p' }),
      memo({ name: 'memos/b', state: 1, parent: '' }),
      memo({ name: 'memos/c', parent: 7 }),
    ]);
    expect(memos[0]).toMatchObject({ state: 'ARCHIVED', parent: 'memos/p' });
    expect(memos[1]).not.toHaveProperty('state');
    expect(memos[1]).not.toHaveProperty('parent');
    expect(memos[2]).not.toHaveProperty('parent');
  });

  it('keeps only text tags', async () => {
    const { memos } = await listOf([memo({ tags: ['a', 1, null, 'b'] })]);
    expect(memos[0]?.tags).toEqual(['a', 'b']);
    const { memos: none } = await listOf([memo({ tags: 'a' })]);
    expect(none[0]?.tags).toEqual([]);
  });

  it('accepts names of up to 36 characters with inner hyphens only', async () => {
    const ok = `memos/${'a'.repeat(36)}`;
    const names = [
      'memos/a',
      'memos/a-b',
      ok,
      `memos/${'a'.repeat(37)}`,
      'memos/-a',
      'memos/a-',
      'xmemos/a',
      'memos/a/b',
      'memos/a_b',
    ];
    const { memos, warnings } = await listOf(
      names.map((name) => memo({ name })),
    );
    expect(memos.map((m) => m.name)).toEqual(['memos/a', 'memos/a-b', ok]);
    expect(warnings).toEqual([
      'Entry 4 of the Memos response is unusable and is skipped',
      'Entry 5 of the Memos response is unusable and is skipped',
      'Entry 6 of the Memos response is unusable and is skipped',
      'Entry 7 of the Memos response is unusable and is skipped',
      'Entry 8 of the Memos response is unusable and is skipped',
      'Entry 9 of the Memos response is unusable and is skipped',
    ]);
  });

  it('skips entries that are no object, have no name or no text', async () => {
    const { memos, warnings } = await listOf([
      null,
      [memo()],
      'memos/a',
      { content: 'x' },
      { name: 5, content: 'x' },
      { name: 'memos/a' },
      { name: 'memos/a', content: 5 },
    ]);
    expect(memos).toEqual([]);
    expect(warnings).toHaveLength(7);
    expect(warnings[0]).toBe(
      'Entry 1 of the Memos response is unusable and is skipped',
    );
  });
});

describe('reading the attachments of a memo', () => {
  const attachmentsOf = async (attachments: unknown) =>
    (await listOf([memo({ attachments })])).memos[0]?.attachments;

  it('keeps name, file name, type, size and an external link', async () => {
    expect(
      await attachmentsOf([
        {
          name: 'attachments/x',
          filename: 'a.pdf',
          type: 'application/pdf',
          size: '12',
          externalLink: 'https://example.org/a.pdf',
        },
        { name: 'attachments/y', filename: 'b.png', size: 3 },
      ]),
    ).toEqual([
      {
        name: 'attachments/x',
        filename: 'a.pdf',
        type: 'application/pdf',
        size: '12',
        externalLink: 'https://example.org/a.pdf',
      },
      { name: 'attachments/y', filename: 'b.png', type: '', size: 3 },
    ]);
  });

  it('leaves out a size or link of the wrong kind and an empty link', async () => {
    const [entry] = (await attachmentsOf([
      {
        name: 'attachments/x',
        filename: 'a.pdf',
        type: 7,
        size: null,
        externalLink: '',
      },
    ])) as MemoAttachmentRaw[];
    expect(entry).toEqual({
      name: 'attachments/x',
      filename: 'a.pdf',
      type: '',
    });
    const [other] = (await attachmentsOf([
      { name: 'attachments/x', filename: 'a.pdf', size: {}, externalLink: 3 },
    ])) as MemoAttachmentRaw[];
    expect(other).toEqual({
      name: 'attachments/x',
      filename: 'a.pdf',
      type: '',
    });
  });

  it('drops attachments without name or file name, and non-objects', async () => {
    expect(
      await attachmentsOf([
        null,
        'attachments/x',
        [{ name: 'attachments/x', filename: 'a' }],
        { filename: 'a.pdf' },
        { name: 1, filename: 'a.pdf' },
        { name: 'attachments/x' },
        { name: 'attachments/x', filename: 2 },
        { name: 'attachments/x', filename: '' },
        { name: 'attachments/ok', filename: 'ok.pdf' },
      ]),
    ).toEqual([{ name: 'attachments/ok', filename: 'ok.pdf', type: '' }]);
  });

  it('reads no attachments when the field is not a list', async () => {
    expect(
      await attachmentsOf({ name: 'attachments/x', filename: 'a' }),
    ).toEqual([]);
  });
});

describe('the list request', () => {
  it('cuts trailing slashes off the address and sends JSON headers', async () => {
    const fetchMock = vi.fn(async () => page([]));
    const source = createHttpMemosSource({
      baseUrl: `${BASE}/sub///`,
      fetch: fetchMock,
      pageSize: 7,
    });
    await source.listPublicMemos();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/sub/api/memos');
    expect(parsed.searchParams.get('page_size')).toBe('7');
    expect(parsed.searchParams.has('page_token')).toBe(false);
    expect(init.headers).toEqual({ accept: 'application/json' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('keeps a path with an inner slash', async () => {
    const fetchMock = vi.fn(async () => page([]));
    await createHttpMemosSource({
      baseUrl: `${BASE}/a/b`,
      fetch: fetchMock,
    }).listPublicMemos();
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(new URL(url).pathname).toBe('/a/b/api/memos');
  });

  it('sends the page token of the previous page', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(page([memo()], 'next-1'))
      .mockResolvedValueOnce(page([memo({ name: 'memos/b' })], 5));
    const source = createHttpMemosSource({ baseUrl: BASE, fetch: fetchMock });
    const { memos } = await source.listPublicMemos();
    expect(memos).toHaveLength(2);
    const second = new URL(fetchMock.mock.calls[1]?.[0] as string);
    expect(second.searchParams.get('page_token')).toBe('next-1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('names the address in its errors', () => {
    expect(() => createHttpMemosSource({ baseUrl: 'nix' })).toThrow(
      'Invalid Memos address: nix',
    );
    expect(() => createHttpMemosSource({ baseUrl: 'ftp://m' })).toThrow(
      'The Memos address must start with http or https: ftp://m',
    );
    expect(() => createHttpMemosSource({ baseUrl: 'https://m' })).not.toThrow();
  });

  const failing = async (
    answer: () => Promise<Response>,
    maxPages?: number,
  ) => {
    const source = createHttpMemosSource({
      baseUrl: BASE,
      fetch: answer,
      ...(maxPages === undefined ? {} : { maxPages }),
    });
    return source.listPublicMemos().then(
      () => 'no error',
      (error: Error) => error.message,
    );
  };

  it('explains each failure in words', async () => {
    expect(
      await failing(async () => {
        throw new Error('boom');
      }),
    ).toBe('Memos is unreachable (boom)');
    expect(
      await failing(async () => {
        throw 'plain';
      }),
    ).toBe('Memos is unreachable (plain)');
    expect(await failing(async () => json('', { status: 403 }))).toBe(
      'The Memos instance requires a login. The access mode of the instance must be PUBLIC.',
    );
    expect(await failing(async () => json('', { status: 300 }))).toBe(
      'Memos redirects (HTTP 300), redirects are not followed',
    );
    expect(await failing(async () => json('', { status: 399 }))).toBe(
      'Memos redirects (HTTP 399), redirects are not followed',
    );
    expect(await failing(async () => json('', { status: 400 }))).toBe(
      'Memos responds with HTTP 400',
    );
    expect(await failing(async () => json('{'))).toBe(
      'The response of the Memos instance is not valid JSON',
    );
    expect(await failing(async () => json({ memos: {} }))).toBe(
      'Unexpected response from the Memos instance (field "memos" is missing)',
    );
    expect(await failing(async () => json('null'))).toBe(
      'Unexpected response from the Memos instance (field "memos" is missing)',
    );
    expect(await failing(async () => page([], 'same'), 1)).toBe(
      'Memos returns more than 1 pages',
    );
    expect(await failing(async () => page([], 'same'))).toBe(
      'Memos returns a repeated page token',
    );
  });
});

describe('fetching an attachment over HTTP', () => {
  const attachment: MemoAttachmentRaw = {
    name: 'attachments/abc',
    filename: 'a b.pdf',
    type: '',
  };

  const fetchWith = (answer: Response | (() => Response), maxBytes = 100) => {
    const fetchMock = vi.fn(async () =>
      typeof answer === 'function' ? answer() : answer,
    );
    const source = createHttpMemosSource({ baseUrl: BASE, fetch: fetchMock });
    return {
      fetchMock,
      result: source.fetchAttachment(attachment, maxBytes),
    };
  };

  it('asks for the file route with the encoded file name', async () => {
    const { fetchMock, result } = fetchWith(new Response('abc'));
    expect(await result).toEqual({ ok: true, data: Buffer.from('abc') });
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(
      `${BASE}/file/attachments/abc/a%20b.pdf`,
    );
  });

  it('accepts names of up to 64 characters with _ and -', async () => {
    const source = createHttpMemosSource({
      baseUrl: BASE,
      fetch: async () => new Response('x'),
    });
    const fetchOf = (name: string, filename = 'f') =>
      source.fetchAttachment({ name, filename, type: '' }, 10);
    expect((await fetchOf(`attachments/a${'_-b'.repeat(21)}`)).ok).toBe(true);
    for (const name of [
      `attachments/a${'b'.repeat(64)}`,
      'attachments/_a',
      'xattachments/a',
      'attachments/a/b',
      'attachments/',
    ]) {
      expect(await fetchOf(name)).toEqual({
        ok: false,
        code: 'invalid',
        reason: `invalid attachment "${name}"`,
      });
    }
    expect(await fetchOf('attachments/a', '')).toMatchObject({
      code: 'invalid',
    });
  });

  it('answers redirects, missing files and denied access', async () => {
    expect(await fetchWith(new Response('', { status: 300 })).result).toEqual({
      ok: false,
      code: 'redirect',
      reason: 'Memos redirects, redirects are not followed',
    });
    expect(
      await fetchWith(new Response('', { status: 399 })).result,
    ).toMatchObject({ code: 'redirect' });
    expect(await fetchWith(new Response('', { status: 404 })).result).toEqual({
      ok: false,
      code: 'not-found',
      reason: 'File not found',
    });
    for (const status of [401, 403]) {
      await expect(
        fetchWith(new Response('', { status })).result,
      ).rejects.toThrow(
        `Access to the attachment was denied (HTTP ${status}), check the access mode`,
      );
    }
    await expect(
      fetchWith(new Response('', { status: 400 })).result,
    ).rejects.toThrow('Memos responds to the attachment with HTTP 400');
  });

  it('takes a file of exactly the limit and refuses one byte more', async () => {
    expect(await fetchWith(new Response('12345'), 5).result).toEqual({
      ok: true,
      data: Buffer.from('12345'),
    });
    expect(await fetchWith(new Response('123456'), 5).result).toEqual({
      ok: false,
      code: 'too-large',
      reason: 'larger than 5 bytes',
    });
  });

  it('trusts the announced length only above the limit', async () => {
    const announced = (length: string) =>
      new Response('12345', { headers: { 'content-length': length } });
    expect((await fetchWith(announced('5'), 5).result).ok).toBe(true);
    const cancel = vi.fn(async () => undefined);
    const big = announced('6');
    Object.defineProperty(big, 'body', {
      value: { cancel },
    });
    expect(await fetchWith(big, 5).result).toMatchObject({
      code: 'too-large',
    });
    expect(cancel).toHaveBeenCalled();
  });

  it('gives an empty file when there is no body', async () => {
    expect(await fetchWith(new Response(null), 5).result).toEqual({
      ok: true,
      data: Buffer.alloc(0),
    });
  });

  it('turns a broken stream into a MemosError', async () => {
    const broken = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error('cut'));
      },
    });
    await expect(fetchWith(new Response(broken)).result).rejects.toThrow(
      'The attachment could not be read (cut)',
    );
  });
});

describe('the sample source (files)', () => {
  let folder: string;
  beforeEach(async () => {
    folder = await mkdtemp(path.join(os.tmpdir(), 'memos-fixture-'));
  });
  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  it('reads memos.json like a list answer', async () => {
    await writeFile(
      path.join(folder, 'memos.json'),
      JSON.stringify({ memos: [memo(), 'x'] }),
    );
    const { memos, warnings } =
      await createFixtureMemosSource(folder).listPublicMemos();
    expect(memos.map((m) => m.name)).toEqual(['memos/a1']);
    expect(warnings).toEqual([
      'Entry 2 of the Memos response is unusable and is skipped',
    ]);
  });

  it('says when memos.json cannot be read', async () => {
    await expect(
      createFixtureMemosSource(folder).listPublicMemos(),
    ).rejects.toThrow(/^memos\.json is not readable \(/);
  });

  it('reads attachments up to the limit and refuses bad names', async () => {
    await mkdir(path.join(folder, 'attachments', 'abc'), { recursive: true });
    await writeFile(path.join(folder, 'attachments', 'abc', 'f.txt'), '12345');
    const source = createFixtureMemosSource(folder);
    const get = (filename: string, max = 5, name = 'attachments/abc') =>
      source.fetchAttachment({ name, filename, type: '' }, max);
    expect(await get('f.txt')).toEqual({
      ok: true,
      data: Buffer.from('12345'),
    });
    expect(await get('f.txt', 4)).toEqual({
      ok: false,
      code: 'too-large',
      reason: 'too large',
    });
    expect(await get('missing.txt')).toEqual({
      ok: false,
      code: 'not-found',
      reason: 'File not found',
    });
    for (const filename of ['', 'a/b', 'a\\b', '.hidden']) {
      expect(await get(filename)).toEqual({
        ok: false,
        code: 'invalid',
        reason: 'invalid attachment "attachments/abc"',
      });
    }
    expect(await get('f.txt', 5, 'attachments/-x')).toMatchObject({
      code: 'invalid',
    });
  });

  it('answers not-found for a folder in place of a file', async () => {
    await mkdir(path.join(folder, 'attachments', 'abc', 'dir'), {
      recursive: true,
    });
    const source = createFixtureMemosSource(folder);
    expect(
      await source.fetchAttachment(
        { name: 'attachments/abc', filename: 'dir', type: '' },
        1_000_000,
      ),
    ).toEqual({ ok: false, code: 'not-found', reason: 'File not found' });
  });
});

// ---------------------------------------------------------------------------
// Building the entries: exact texts, sizes, order and the fingerprint.

const raw = (uid: string, extra: Partial<MemoRaw> = {}): MemoRaw => ({
  name: `memos/${uid}`,
  content: 'Hallo',
  visibility: 'PUBLIC',
  state: 'NORMAL',
  createTime: '2026-11-02T13:32:00Z',
  tags: [],
  attachments: [],
  ...extra,
});

function sourceOf(
  memos: MemoRaw[],
  files: Record<string, Buffer> = {},
): MemosSource {
  return {
    listPublicMemos: async () => ({ memos, warnings: ['from the list'] }),
    fetchAttachment: async (attachment) => {
      const data = files[attachment.name];
      return data === undefined
        ? { ok: false, code: 'not-found', reason: 'gone' }
        : { ok: true, data };
    },
  };
}

const pdfOf = (bytes: number) =>
  Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(bytes - 9)]);

describe('buildMemoEntries: exact results', () => {
  it('passes on the warnings of the list first', async () => {
    const { warnings } = await buildMemoEntries(sourceOf([]), new Map());
    expect(warnings).toEqual(['from the list']);
  });

  it('writes PDF sizes in B, KB and MB at the exact borders', async () => {
    const sizes = [1023, 1024, 1024 * 1024 - 1, 1024 * 1024];
    const memos = sizes.map((size, i) =>
      raw(`p${i}`, {
        attachments: [
          { name: `attachments/f${i}`, filename: `${i}.pdf`, type: '' },
        ],
      }),
    );
    const files = Object.fromEntries(
      sizes.map((size, i) => [`attachments/f${i}`, pdfOf(size)]),
    );
    const { memos: entries } = await buildMemoEntries(
      sourceOf(memos, files),
      new Map(),
    );
    const label = (uid: string) =>
      /\(PDF, ([^)]*)\)/.exec(
        entries.find((e) => e.uid === uid)?.html ?? '',
      )?.[1];
    expect(label('p0')).toBe('1023 B');
    expect(label('p1')).toBe('1 KB');
    expect(label('p2')).toBe('1024 KB');
    expect(label('p3')).toBe('1.0 MB');
  });

  it('wraps attachments in one block and leaves it out without them', async () => {
    const files = { 'attachments/f': pdfOf(100) };
    const withFile = raw('a', {
      attachments: [{ name: 'attachments/f', filename: 'f.pdf', type: '' }],
    });
    const { memos } = await buildMemoEntries(
      sourceOf([withFile, raw('b')], files),
      new Map(),
    );
    const html = (uid: string) => memos.find((m) => m.uid === uid)?.html ?? '';
    expect(html('a')).toMatch(
      /<div class="memo-attachments"><p class="attachment"><a href="\/media\/[0-9a-f]{16}-f\.pdf" rel="noopener">f\.pdf<\/a> \(PDF, 100 B\)<\/p><\/div>$/,
    );
    expect(html('b')).not.toContain('memo-attachments');
  });

  it('builds audio and video players with the prefix', async () => {
    const mp3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(50)]);
    const mp4 = Buffer.concat([
      Buffer.from([0, 0, 0, 0x18]),
      Buffer.from('ftypisom'),
      Buffer.alloc(50),
    ]);
    const memo = raw('m', {
      attachments: [
        { name: 'attachments/a', filename: 'a.mp3', type: '' },
        { name: 'attachments/v', filename: 'v.mp4', type: '' },
      ],
    });
    const { memos } = await buildMemoEntries(
      sourceOf([memo], { 'attachments/a': mp3, 'attachments/v': mp4 }),
      new Map(),
      { urlPrefix: '/x/' },
    );
    const html = memos[0]?.html ?? '';
    expect(html).toMatch(
      /<audio controls preload="none" src="\/x\/[0-9a-f]{16}-a\.mp3"><a href="\/x\/[0-9a-f]{16}-a\.mp3" rel="noopener">a\.mp3<\/a><\/audio>/,
    );
    expect(html).toMatch(
      /<video controls preload="none" playsinline src="\/x\/[0-9a-f]{16}-v\.mp4"><a /,
    );
  });

  it('names the reason of a skipped attachment', async () => {
    const memo = raw('w', {
      attachments: [
        { name: 'attachments/g', filename: 'gone.pdf', type: '' },
        { name: 'attachments/x', filename: 'x.exe', type: '' },
        {
          name: 'attachments/e',
          filename: 'e.pdf',
          type: '',
          externalLink: 'https://e',
        },
        { name: 'attachments/h', filename: 'h.HEIF', type: '' },
        { name: 'attachments/f', filename: 'fake.pdf', type: '' },
      ],
    });
    const { warnings } = await buildMemoEntries(
      sourceOf([memo], { 'attachments/f': Buffer.from('not a pdf') }),
      new Map(),
    );
    expect(warnings.slice(1)).toEqual([
      'memos/w: attachment "gone.pdf" is skipped (gone)',
      'memos/w: attachment "x.exe" has a file type that is not allowed and is skipped',
      'memos/w: attachment "e.pdf" is external and is not loaded',
      'memos/w: attachment "h.HEIF" has a file type that is not allowed and is skipped (HEIC photos need the converter heif-convert, which is not available: please upload as JPEG)',
      'memos/w: attachment "fake.pdf" does not match its extension and is skipped',
    ]);
  });

  it('passes a HEIC photo to the converter only when it is one', async () => {
    const convert = vi.fn(async () => {
      throw new Error('no');
    });
    const memo = raw('h', {
      attachments: [
        { name: 'attachments/h', filename: 'dir/p.heif', type: '' },
        { name: 'attachments/j', filename: 'p.jpg', type: '' },
      ],
    });
    const { warnings } = await buildMemoEntries(
      sourceOf([memo], {
        'attachments/h': Buffer.from('x'),
        'attachments/j': Buffer.from('y'),
      }),
      new Map(),
      { convertHeic: convert },
    );
    expect(convert).toHaveBeenCalledTimes(1);
    expect(warnings.slice(1)).toEqual([
      'memos/h: attachment "dir/p.heif" is not a readable image and is skipped',
      'memos/h: attachment "p.jpg" is not a readable image and is skipped',
    ]);
  });

  it('warns about memos that are not public, with the visibility', async () => {
    const { memos, warnings } = await buildMemoEntries(
      sourceOf([
        raw('a', { visibility: 'PRIVATE' }),
        raw('b', { visibility: '' }),
        raw('c', { state: 'ARCHIVED' }),
        raw('d', { state: undefined }),
        raw('e', { createTime: '' }),
        raw('f', { createTime: 'nonsense' }),
        raw('g', { parent: 'memos/x' }),
        { ...raw('h'), name: 'memos/-bad' },
      ]),
      new Map(),
    );
    expect(memos.map((m) => m.uid)).toEqual(['d']);
    expect(warnings.slice(1)).toEqual([
      'memos/a: not public (PRIVATE), skipped',
      'memos/b: not public (unknown), skipped',
      'memos/e: invalid createTime "", skipped',
      'memos/f: invalid createTime "nonsense", skipped',
      'memos/-bad: invalid identifier, skipped',
    ]);
  });

  it('takes updated from updateTime, and createTime when it is missing or invalid', async () => {
    const { memos, warnings } = await buildMemoEntries(
      sourceOf([
        raw('a', { updateTime: '2026-11-05T08:00:00Z' }),
        raw('b'),
        raw('c', { updateTime: 'nonsense' }),
      ]),
      new Map(),
    );
    const byUid = new Map(memos.map((m) => [m.uid, m]));
    expect(byUid.get('a')?.created.toISOString()).toBe(
      '2026-11-02T13:32:00.000Z',
    );
    expect(byUid.get('a')?.updated.toISOString()).toBe(
      '2026-11-05T08:00:00.000Z',
    );
    expect(byUid.get('b')?.updated).toEqual(byUid.get('b')?.created);
    expect(byUid.get('c')?.updated).toEqual(byUid.get('c')?.created);
    expect(warnings).toContain(
      'memos/c: invalid updateTime "nonsense", createTime is used',
    );
    expect(warnings.filter((w) => w.startsWith('memos/b'))).toEqual([]);
  });

  it('orders memos of the same time by their identifier', async () => {
    const { memos } = await buildMemoEntries(
      sourceOf([
        raw('b'),
        raw('c'),
        raw('a'),
        raw('z', { createTime: '2027-01-01T00:00:00Z' }),
      ]),
      new Map(),
    );
    expect(memos.map((m) => m.uid)).toEqual(['z', 'a', 'b', 'c']);
  });

  it('cuts the description at a word only in its second half', async () => {
    const describe = async (content: string, descriptionChars: number) =>
      (
        await buildMemoEntries(sourceOf([raw('d', { content })]), new Map(), {
          descriptionChars,
        })
      ).memos[0]?.description;
    expect(await describe('abcd efgh', 9)).toBe('abcd efgh');
    expect(await describe('abcd efghi', 9)).toBe('abcd efgh…');
    expect(await describe('abcde fghij', 9)).toBe('abcde…');
    expect(await describe('abcde fghijk', 10)).toBe('abcde fghi…');
    expect(await describe('abcdef ghijk', 10)).toBe('abcdef…');
    expect(await describe('ab cdefghijkl', 9)).toBe('ab cdefgh…');
    expect(await describe('abcdefgh ijkl', 8)).toBe('abcdefgh…');
    expect(await describe('  a\n\n  b `c`  ', 20)).toBe('a b c');
    expect(await describe('# Head\n\n```\ncode\n```', 20)).toBe('Head');
  });
});

describe('memosFingerprint', () => {
  const base = raw('a', {
    tags: ['x', 'y'],
    attachments: [
      { name: 'attachments/f', filename: 'f.pdf', type: 't', size: 3 },
    ],
  });
  const print = (memos: MemoRaw[]) => memosFingerprint(memos);

  it('ignores the order of memos, tags and attachments', () => {
    const other = raw('b');
    const second = { name: 'attachments/g', filename: 'g', type: '' };
    expect(print([base, other])).toBe(print([other, base]));
    expect(print([{ ...base, tags: ['y', 'x'] }])).toBe(print([base]));
    expect(
      print([{ ...base, attachments: [...(base.attachments ?? []), second] }]),
    ).toBe(
      print([{ ...base, attachments: [second, ...(base.attachments ?? [])] }]),
    );
  });

  it('changes with text, time, tags and every attachment field', () => {
    const before = print([base]);
    const changed = (extra: Partial<MemoRaw>) => print([{ ...base, ...extra }]);
    const attachment = base.attachments?.[0] as MemoAttachmentRaw;
    for (const variant of [
      changed({ content: 'other' }),
      changed({ createTime: '2027-01-01T00:00:00Z' }),
      changed({ tags: ['x'] }),
      changed({ name: 'memos/b' }),
      changed({ attachments: [{ ...attachment, name: 'attachments/g' }] }),
      changed({ attachments: [{ ...attachment, filename: 'g' }] }),
      changed({ attachments: [{ ...attachment, type: 'u' }] }),
      changed({ attachments: [{ ...attachment, size: 4 }] }),
      changed({ attachments: [] }),
    ]) {
      expect(variant).not.toBe(before);
    }
  });

  it('treats missing tags, attachments and size like empty ones', () => {
    const plain = raw('a');
    expect(print([{ ...plain, tags: undefined, attachments: undefined }])).toBe(
      print([plain]),
    );
    const noSize = { name: 'attachments/f', filename: 'f', type: '' };
    expect(print([{ ...plain, attachments: [noSize] }])).toBe(
      print([{ ...plain, attachments: [{ ...noSize, size: '' }] }]),
    );
    expect(print([])).toMatch(/^[0-9a-f]{64}$/);
  });
});
