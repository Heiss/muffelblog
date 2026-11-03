import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import {
  MemosError,
  buildMemoEntries,
  createHttpMemosSource,
  type FetchedAttachment,
  type MemoAttachmentRaw,
  type MemoRaw,
  type MemosSource,
} from './memos.ts';

const BASE = 'http://memos.test:5230';

function response(body: unknown, init: ResponseInit = {}): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

const rawMemo = (uid: string, extra: Partial<MemoRaw> = {}): MemoRaw => ({
  name: `memos/${uid}`,
  content: 'Hallo',
  visibility: 'PUBLIC',
  state: 'NORMAL',
  createTime: '2026-11-02T13:32:00Z',
  tags: [],
  attachments: [],
  ...extra,
});

describe('createHttpMemosSource: list', () => {
  it('asks only for public memos, newest first', async () => {
    const fetchMock = vi.fn(async () =>
      response({ memos: [rawMemo('a')], nextPageToken: '' }),
    );
    const source = createHttpMemosSource({ baseUrl: BASE, fetch: fetchMock });
    const { memos } = await source.listPublicMemos();
    expect(memos.map((m) => m.name)).toEqual(['memos/a']);

    const aufruf = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const url = new URL(aufruf[0]);
    expect(url.origin).toBe(BASE);
    expect(url.pathname).toBe('/api/memos');
    expect(url.searchParams.get('filter')).toBe('visibility == "PUBLIC"');
    expect(url.searchParams.get('order_by')).toBe('create_time desc');
    expect(url.searchParams.get('page_size')).toBe('100');
    expect(aufruf[1].redirect).toBe('manual');
    expect(JSON.stringify(aufruf[1].headers ?? {})).not.toMatch(
      /authorization/i,
    );
  });

  it('follows nextPageToken across several pages', async () => {
    const seiten = [
      { memos: [rawMemo('a')], nextPageToken: 'tok1' },
      { memos: [rawMemo('b')], nextPageToken: '' },
    ];
    const fetchMock = vi.fn(async () => response(seiten.shift()));
    const source = createHttpMemosSource({
      baseUrl: `${BASE}/`,
      fetch: fetchMock,
    });
    const { memos } = await source.listPublicMemos();
    expect(memos.map((m) => m.name)).toEqual(['memos/a', 'memos/b']);
    const zweite = new URL((fetchMock.mock.calls[1] as unknown as [string])[0]);
    expect(zweite.searchParams.get('page_token')).toBe('tok1');
  });

  it('aborts if a page token repeats', async () => {
    const fetchMock = vi.fn(async () =>
      response({ memos: [rawMemo('a')], nextPageToken: 'gleich' }),
    );
    const source = createHttpMemosSource({ baseUrl: BASE, fetch: fetchMock });
    await expect(source.listPublicMemos()).rejects.toBeInstanceOf(MemosError);
  });

  it('aborts if too many pages arrive', async () => {
    let n = 0;
    const fetchMock = vi.fn(async () =>
      response({ memos: [], nextPageToken: `t${n++}` }),
    );
    const source = createHttpMemosSource({
      baseUrl: BASE,
      fetch: fetchMock,
      maxPages: 3,
    });
    await expect(source.listPublicMemos()).rejects.toBeInstanceOf(MemosError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('returns nothing partial if the second page fails', async () => {
    const seiten: Array<() => Response> = [
      () => response({ memos: [rawMemo('a')], nextPageToken: 'tok1' }),
      () => response('Fehler', { status: 500 }),
    ];
    const fetchMock = vi.fn(async () => (seiten.shift() as () => Response)());
    const source = createHttpMemosSource({ baseUrl: BASE, fetch: fetchMock });
    await expect(source.listPublicMemos()).rejects.toBeInstanceOf(MemosError);
  });

  it('explains that the access mode must be PUBLIC if the instance requires a login', async () => {
    const source = createHttpMemosSource({
      baseUrl: BASE,
      fetch: async () => response({ message: 'x' }, { status: 401 }),
    });
    await expect(source.listPublicMemos()).rejects.toThrow(/PUBLIC/);
  });

  it('reports server errors, network errors, broken JSON and unexpected responses', async () => {
    const error: Array<() => Promise<Response>> = [
      async () => response('x', { status: 500 }),
      async () => response('x', { status: 404 }),
      async () => {
        throw new TypeError('fetch failed');
      },
      async () => response('kein json'),
      async () => response({ foo: 1 }),
      async () => response([]),
    ];
    for (const f of error) {
      const source = createHttpMemosSource({ baseUrl: BASE, fetch: f });
      await expect(source.listPublicMemos()).rejects.toBeInstanceOf(MemosError);
    }
  });

  it('skips unusable entries with a warning without discarding everything', async () => {
    const fetchMock = async () =>
      response({
        memos: [
          rawMemo('gut'),
          'text',
          { name: 'nope/1', content: 'x' },
          { name: 'memos/ohneinhalt' },
        ],
        nextPageToken: '',
      });
    const source = createHttpMemosSource({ baseUrl: BASE, fetch: fetchMock });
    const { memos, warnings } = await source.listPublicMemos();
    expect(memos.map((m) => m.name)).toEqual(['memos/gut']);
    expect(warnings.length).toBe(3);
  });

  it('accepts only http(s) addresses', () => {
    for (const adresse of [
      'ftp://x',
      'memos.test',
      'javascript:alert(1)',
      '',
    ]) {
      expect(() => createHttpMemosSource({ baseUrl: adresse })).toThrow(
        MemosError,
      );
    }
  });
});

describe('createHttpMemosSource: attachments', () => {
  const attachment = (
    extra: Partial<MemoAttachmentRaw> = {},
  ): MemoAttachmentRaw => ({
    name: 'attachments/abc123',
    filename: 'Bericht Final.pdf',
    type: 'application/pdf',
    size: '10',
    ...extra,
  });

  it('loads through the file route without login and without redirects', async () => {
    const fetchMock = vi.fn(
      async () => new Response(Buffer.from('%PDF-1.4 hallo'), { status: 200 }),
    );
    const source = createHttpMemosSource({ baseUrl: BASE, fetch: fetchMock });
    const result = await source.fetchAttachment(attachment(), 1000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.toString()).toBe('%PDF-1.4 hallo');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      `${BASE}/file/attachments/abc123/${encodeURIComponent('Bericht Final.pdf')}`,
    );
    expect(init.redirect).toBe('manual');
  });

  it('reports missing files as not-found', async () => {
    const source = createHttpMemosSource({
      baseUrl: BASE,
      fetch: async () => response({}, { status: 404 }),
    });
    expect(await source.fetchAttachment(attachment(), 1000)).toMatchObject({
      ok: false,
      code: 'not-found',
    });
  });

  it('follows no redirect', async () => {
    const source = createHttpMemosSource({
      baseUrl: BASE,
      fetch: async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'http://127.0.0.1/geheim' },
        }),
    });
    expect(await source.fetchAttachment(attachment(), 1000)).toMatchObject({
      ok: false,
      code: 'redirect',
    });
  });

  it('rejects files that are too large at the header without reading the content', async () => {
    const source = createHttpMemosSource({
      baseUrl: BASE,
      fetch: async () =>
        new Response(Buffer.alloc(10), {
          status: 200,
          headers: { 'content-length': '5000' },
        }),
    });
    expect(await source.fetchAttachment(attachment(), 1000)).toMatchObject({
      ok: false,
      code: 'too-large',
    });
  });

  it('aborts while reading if the content exceeds the limit', async () => {
    const source = createHttpMemosSource({
      baseUrl: BASE,
      fetch: async () => new Response(Buffer.alloc(5000), { status: 200 }),
    });
    expect(await source.fetchAttachment(attachment(), 1000)).toMatchObject({
      ok: false,
      code: 'too-large',
    });
  });

  it('rejects invalid attachment identifiers without fetching anything', async () => {
    const fetchMock = vi.fn(async () => new Response('x'));
    const source = createHttpMemosSource({ baseUrl: BASE, fetch: fetchMock });
    for (const name of [
      'attachments/../x',
      'attachments/a/b',
      'foo/abc',
      'attachments/',
      'attachments/a b',
    ]) {
      expect(
        await source.fetchAttachment(attachment({ name }), 1000),
      ).toMatchObject({ ok: false, code: 'invalid' });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws on a login requirement, server error and network error so the build stops', async () => {
    for (const f of [
      async () => response({}, { status: 401 }),
      async () => response({}, { status: 403 }),
      async () => response({}, { status: 500 }),
      async () => {
        throw new TypeError('fetch failed');
      },
    ]) {
      const source = createHttpMemosSource({ baseUrl: BASE, fetch: f });
      await expect(
        source.fetchAttachment(attachment(), 1000),
      ).rejects.toBeInstanceOf(MemosError);
    }
  });
});

/** Source with fixed memos and files, without network. */
function fakeSource(
  memos: MemoRaw[],
  files: Record<string, Buffer | FetchedAttachment> = {},
): MemosSource & { fetched: string[] } {
  const fetched: string[] = [];
  return {
    fetched,
    listPublicMemos: async () => ({ memos, warnings: [] }),
    fetchAttachment: async (attachment) => {
      fetched.push(attachment.name);
      const entry = files[attachment.name];
      if (entry === undefined)
        return { ok: false, code: 'not-found', reason: 'not found' };
      return Buffer.isBuffer(entry) ? { ok: true, data: entry } : entry;
    },
  };
}

async function png(breite = 800, hoehe = 400): Promise<Buffer> {
  return sharp({
    create: {
      width: breite,
      height: hoehe,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .png()
    .toBuffer();
}

const attachmentRaw = (
  uid: string,
  filename: string,
  extra: Partial<MemoAttachmentRaw> = {},
): MemoAttachmentRaw => ({
  name: `attachments/${uid}`,
  filename,
  type: 'application/octet-stream',
  size: '100',
  ...extra,
});

describe('buildMemoEntries: basic data', () => {
  it('builds identifier, date, title from date and time, and path', async () => {
    const source = fakeSource([
      rawMemo('abc', { content: 'Renovate eingerichtet.' }),
    ]);
    const { memos, warnings } = await buildMemoEntries(source, new Map());
    expect(warnings).toEqual([]);
    expect(memos).toHaveLength(1);
    const memo = memos[0];
    expect(memo?.uid).toBe('abc');
    expect(memo?.date.toISOString()).toBe('2026-11-02T13:32:00.000Z');
    expect(memo?.title).toBe('Memo vom 2. Nov. 2026, 14:32');
    expect(memo?.path).toBe('memos/abc');
    expect(memo?.html).toContain('<p>Renovate eingerichtet.</p>');
  });

  it('converts the time to summer time', async () => {
    const source = fakeSource([
      rawMemo('s', { createTime: '2026-07-01T07:30:00Z' }),
    ]);
    const { memos } = await buildMemoEntries(source, new Map());
    expect(memos[0]?.title).toBe('Memo vom 1. Juli 2026, 09:30');
  });

  it('builds the description from the text without Markdown and cuts it', async () => {
    const lang = `**Fett** und [Link](https://example.org) ${'wort '.repeat(80)}`;
    const source = fakeSource([rawMemo('d', { content: lang })]);
    const { memos } = await buildMemoEntries(source, new Map());
    const description = memos[0]?.description ?? '';
    expect(description.startsWith('Fett und Link wort')).toBe(true);
    expect(description.length).toBeLessThanOrEqual(161);
    expect(description.endsWith('…')).toBe(true);
    expect(description).not.toContain('*');
    expect(description).not.toContain('https');
  });

  it('cuts the description to the configured length', async () => {
    const source = fakeSource([rawMemo('d', { content: 'wort '.repeat(80) })]);
    const { memos } = await buildMemoEntries(source, new Map(), {
      descriptionChars: 40,
    });
    const description = memos[0]?.description ?? '';
    expect(description.length).toBeLessThanOrEqual(41);
    expect(description.endsWith('…')).toBe(true);
    expect(description.length).toBeGreaterThan(20);
  });

  it('leaves the description empty if there is no text', async () => {
    const source = fakeSource([rawMemo('e', { content: '' })]);
    const { memos } = await buildMemoEntries(source, new Map());
    expect(memos[0]?.description).toBe('');
  });

  it('normalizes tags: lowercase, without #, duplicates drop out, nested ones stay one tag', async () => {
    const source = fakeSource([
      rawMemo('t', {
        tags: ['Tooling', '#Tooling', 'a/b', ' Über Größe ', ''],
      }),
    ]);
    const { memos } = await buildMemoEntries(source, new Map());
    expect(memos[0]?.tags).toEqual(['tooling', 'a/b', 'über größe']);
  });

  it('removes parent tags that Memos creates itself from nested tags', async () => {
    // Memos returns the tags "a" and "a/b" for "#a/b" (proven by the contract test).
    const source = fakeSource([
      rawMemo('v', { tags: ['contract', 'a', 'a/b'] }),
      rawMemo('w', { tags: ['x', 'x/y', 'x/y/z', 'andere'] }),
      rawMemo('u', { tags: ['a'] }),
      rawMemo('t', { tags: ['ab', 'a/b'] }),
    ]);
    const { memos } = await buildMemoEntries(source, new Map());
    const tags = Object.fromEntries(memos.map((m) => [m.uid, m.tags]));
    expect(tags.v).toEqual(['contract', 'a/b']);
    expect(tags.w).toEqual(['x/y/z', 'andere']);
    expect(tags.u).toEqual(['a']);
    expect(tags.t).toEqual(['ab', 'a/b']);
  });

  it('sorts by date, newest first', async () => {
    const source = fakeSource([
      rawMemo('alt', { createTime: '2026-01-01T10:00:00Z' }),
      rawMemo('neu', { createTime: '2026-03-01T10:00:00Z' }),
    ]);
    const { memos } = await buildMemoEntries(source, new Map());
    expect(memos.map((m) => m.uid)).toEqual(['neu', 'alt']);
  });

  it('skips non-public, archived and comment memos', async () => {
    const source = fakeSource([
      rawMemo('privat', { visibility: 'PRIVATE' }),
      rawMemo('geschuetzt', { visibility: 'PROTECTED' }),
      rawMemo('archiv', { state: 'ARCHIVED' }),
      rawMemo('kommentar', { parent: 'memos/abc' }),
      rawMemo('ok'),
    ]);
    const { memos, warnings } = await buildMemoEntries(source, new Map());
    expect(memos.map((m) => m.uid)).toEqual(['ok']);
    expect(warnings.some((w) => w.includes('privat'))).toBe(true);
    expect(warnings.some((w) => w.includes('geschuetzt'))).toBe(true);
  });

  it('skips memos with an invalid date or invalid identifier', async () => {
    const source = fakeSource([
      rawMemo('datum', { createTime: 'gestern' }),
      rawMemo('../hack'),
      rawMemo('ok'),
    ]);
    const { memos, warnings } = await buildMemoEntries(source, new Map());
    expect(memos.map((m) => m.uid)).toEqual(['ok']);
    expect(warnings.length).toBe(2);
  });
});

describe('buildMemoEntries: sanitizing the text', () => {
  it('removes scripts and foreign images, also from allowed hosts', async () => {
    const text =
      '<script>window.pwned=1</script>\n\n![x](https://upload.wikimedia.org/a.jpg)\n\nText';
    const source = fakeSource([rawMemo('s', { content: text })]);
    const { memos, warnings } = await buildMemoEntries(source, new Map());
    const html = memos[0]?.html ?? '';
    expect(html).not.toContain('<script');
    expect(html).not.toContain('wikimedia');
    expect(html).toContain('Text');
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('buildMemoEntries: attachments', () => {
  it('mirrors images as WebP with alt text from the file name and without a link to the instance', async () => {
    const source = fakeSource(
      [
        rawMemo('b', {
          attachments: [
            attachmentRaw('img1', 'IMG_2043.png', { type: 'image/png' }),
          ],
        }),
      ],
      { 'attachments/img1': await png() },
    );
    const store = new Map<string, Buffer>();
    const { memos, warnings } = await buildMemoEntries(source, store);
    expect(warnings).toEqual([]);
    const html = memos[0]?.html ?? '';
    expect(html).toMatch(/<img [^>]*src="\/media\/[0-9a-f]{16}-480\.webp"/);
    expect(html).toContain('srcset="/media/');
    expect(html).toContain('alt="IMG 2043"');
    expect(html).not.toContain('memos.test');
    expect(html).not.toContain('/file/attachments');
    expect([...store.keys()].every((k) => k.endsWith('.webp'))).toBe(true);
    expect(store.size).toBeGreaterThan(0);
  });

  it('mirrors PDF, audio and video with a fitting element', async () => {
    const wav = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.alloc(4),
      Buffer.from('WAVEfmt '),
      Buffer.alloc(20),
    ]);
    const mp4 = Buffer.concat([
      Buffer.from([0, 0, 0, 0x18]),
      Buffer.from('ftypisom'),
      Buffer.alloc(20),
    ]);
    const source = fakeSource(
      [
        rawMemo('m', {
          attachments: [
            attachmentRaw('p1', 'Mein Bericht.PDF'),
            attachmentRaw('a1', 'Klang.wav'),
            attachmentRaw('v1', 'Film.mp4'),
          ],
        }),
      ],
      {
        'attachments/p1': Buffer.from('%PDF-1.4\nhallo'),
        'attachments/a1': wav,
        'attachments/v1': mp4,
      },
    );
    const store = new Map<string, Buffer>();
    const { memos, warnings } = await buildMemoEntries(source, store);
    expect(warnings).toEqual([]);
    const html = memos[0]?.html ?? '';
    expect(html).toMatch(
      /<a href="\/media\/[0-9a-f]{16}-mein-bericht\.pdf"[^>]*>Mein Bericht\.PDF/,
    );
    expect(html).toMatch(
      /<audio [^>]*controls[^>]*preload="none"[^>]*src="\/media\/[0-9a-f]{16}-klang\.wav"/,
    );
    expect(html).toMatch(
      /<video [^>]*controls[^>]*preload="none"[^>]*src="\/media\/[0-9a-f]{16}-film\.mp4"/,
    );
    expect(
      [...store.keys()].map((k) => k.replace(/^[0-9a-f]{16}-/, '')).sort(),
    ).toEqual(['film.mp4', 'klang.wav', 'mein-bericht.pdf']);
  });

  it('escapes file names in the HTML', async () => {
    const source = fakeSource(
      [rawMemo('x', { attachments: [attachmentRaw('p', '<b>x</b>&"y.pdf')] })],
      {
        'attachments/p': Buffer.from('%PDF-1.4'),
      },
    );
    const { memos } = await buildMemoEntries(source, new Map());
    const html = memos[0]?.html ?? '';
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;&amp;&quot;y.pdf');
  });

  it('skips file types that are not allowed with a warning and does not load them', async () => {
    const source = fakeSource(
      [
        rawMemo('o', {
          attachments: [
            attachmentRaw('h', 'seite.html'),
            attachmentRaw('s', 'logo.svg'),
            attachmentRaw('z', 'archiv.zip'),
            attachmentRaw('e', 'prog.exe'),
            attachmentRaw('i', 'foto.heic'),
          ],
        }),
      ],
      {},
    );
    const { memos, warnings } = await buildMemoEntries(source, new Map());
    expect(source.fetched).toEqual([]);
    expect(memos[0]?.html).not.toMatch(/<(a|img|audio|video)\b/);
    expect(warnings).toHaveLength(5);
    expect(warnings.find((w) => w.includes('foto.heic'))).toMatch(/HEIC/i);
  });

  it('rejects files whose content does not match the extension', async () => {
    const source = fakeSource(
      [rawMemo('f', { attachments: [attachmentRaw('p', 'falsch.pdf')] })],
      {
        'attachments/p': Buffer.from(
          '<!doctype html><script>alert(1)</script>',
        ),
      },
    );
    const store = new Map<string, Buffer>();
    const { memos, warnings } = await buildMemoEntries(source, store);
    expect(memos[0]?.html).not.toContain('falsch.pdf');
    expect(store.size).toBe(0);
    expect(warnings).toHaveLength(1);
  });

  it('rejects images that cannot be read', async () => {
    const source = fakeSource(
      [rawMemo('k', { attachments: [attachmentRaw('i', 'kaputt.png')] })],
      {
        'attachments/i': Buffer.from('kein Bild'),
      },
    );
    const { memos, warnings } = await buildMemoEntries(source, new Map());
    expect(memos[0]?.html).not.toContain('<img');
    expect(warnings).toHaveLength(1);
  });

  it('passes over external attachments because nothing is loaded from foreign services', async () => {
    const source = fakeSource([
      rawMemo('x', {
        attachments: [
          attachmentRaw('e', 'bild.png', {
            externalLink: 'https://s3.example/bild.png',
          }),
        ],
      }),
    ]);
    const { memos, warnings } = await buildMemoEntries(source, new Map());
    expect(source.fetched).toEqual([]);
    expect(memos[0]?.html).not.toContain('s3.example');
    expect(warnings).toHaveLength(1);
  });

  it('keeps the memo and warns if an attachment is missing or too large', async () => {
    const source = fakeSource(
      [
        rawMemo('g', {
          content: 'Text bleibt',
          attachments: [
            attachmentRaw('weg', 'a.pdf'),
            attachmentRaw('gross', 'b.pdf'),
          ],
        }),
      ],
      {
        'attachments/gross': {
          ok: false,
          code: 'too-large',
          reason: 'too large',
        },
      },
    );
    const { memos, warnings } = await buildMemoEntries(source, new Map());
    expect(memos).toHaveLength(1);
    expect(memos[0]?.html).toContain('Text bleibt');
    expect(warnings).toHaveLength(2);
  });

  it('stops the whole build if fetching an attachment fails temporarily', async () => {
    const source: MemosSource = {
      listPublicMemos: async () => ({
        memos: [rawMemo('h', { attachments: [attachmentRaw('p', 'a.pdf')] })],
        warnings: [],
      }),
      fetchAttachment: async () => {
        throw new MemosError('Netzwerkfehler');
      },
    };
    await expect(buildMemoEntries(source, new Map())).rejects.toBeInstanceOf(
      MemosError,
    );
  });

  it('stops if the list cannot be loaded', async () => {
    const source: MemosSource = {
      listPublicMemos: async () => {
        throw new MemosError('unreachable');
      },
      fetchAttachment: async () => ({
        ok: false,
        code: 'not-found',
        reason: '',
      }),
    };
    await expect(buildMemoEntries(source, new Map())).rejects.toThrow(
      'unreachable',
    );
  });

  it('processes identical files only once in the store', async () => {
    const bild = await png(300, 200);
    const source = fakeSource(
      [
        rawMemo('a', { attachments: [attachmentRaw('i1', 'a.png')] }),
        rawMemo('b', { attachments: [attachmentRaw('i2', 'b.png')] }),
      ],
      { 'attachments/i1': bild, 'attachments/i2': bild },
    );
    const store = new Map<string, Buffer>();
    await buildMemoEntries(source, store);
    expect(store.size).toBe(1);
  });
});
