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

function antwort(body: unknown, init: ResponseInit = {}): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

const rohMemo = (uid: string, extra: Partial<MemoRaw> = {}): MemoRaw => ({
  name: `memos/${uid}`,
  content: 'Hallo',
  visibility: 'PUBLIC',
  state: 'NORMAL',
  createTime: '2026-11-02T13:32:00Z',
  tags: [],
  attachments: [],
  ...extra,
});

describe('createHttpMemosSource: Liste', () => {
  it('fragt nur öffentliche Memos ab, neueste zuerst', async () => {
    const fetchMock = vi.fn(async () =>
      antwort({ memos: [rohMemo('a')], nextPageToken: '' }),
    );
    const quelle = createHttpMemosSource({ baseUrl: BASE, fetch: fetchMock });
    const { memos } = await quelle.listPublicMemos();
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

  it('folgt nextPageToken über mehrere Seiten', async () => {
    const seiten = [
      { memos: [rohMemo('a')], nextPageToken: 'tok1' },
      { memos: [rohMemo('b')], nextPageToken: '' },
    ];
    const fetchMock = vi.fn(async () => antwort(seiten.shift()));
    const quelle = createHttpMemosSource({
      baseUrl: `${BASE}/`,
      fetch: fetchMock,
    });
    const { memos } = await quelle.listPublicMemos();
    expect(memos.map((m) => m.name)).toEqual(['memos/a', 'memos/b']);
    const zweite = new URL((fetchMock.mock.calls[1] as unknown as [string])[0]);
    expect(zweite.searchParams.get('page_token')).toBe('tok1');
  });

  it('bricht ab, wenn ein Seitentoken sich wiederholt', async () => {
    const fetchMock = vi.fn(async () =>
      antwort({ memos: [rohMemo('a')], nextPageToken: 'gleich' }),
    );
    const quelle = createHttpMemosSource({ baseUrl: BASE, fetch: fetchMock });
    await expect(quelle.listPublicMemos()).rejects.toBeInstanceOf(MemosError);
  });

  it('bricht ab, wenn zu viele Seiten kommen', async () => {
    let n = 0;
    const fetchMock = vi.fn(async () =>
      antwort({ memos: [], nextPageToken: `t${n++}` }),
    );
    const quelle = createHttpMemosSource({
      baseUrl: BASE,
      fetch: fetchMock,
      maxPages: 3,
    });
    await expect(quelle.listPublicMemos()).rejects.toBeInstanceOf(MemosError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('liefert nichts Teilweises, wenn die zweite Seite scheitert', async () => {
    const seiten: Array<() => Response> = [
      () => antwort({ memos: [rohMemo('a')], nextPageToken: 'tok1' }),
      () => antwort('Fehler', { status: 500 }),
    ];
    const fetchMock = vi.fn(async () => (seiten.shift() as () => Response)());
    const quelle = createHttpMemosSource({ baseUrl: BASE, fetch: fetchMock });
    await expect(quelle.listPublicMemos()).rejects.toBeInstanceOf(MemosError);
  });

  it('erklärt, dass der Zugriffsmodus PUBLIC sein muss, wenn die Instanz eine Anmeldung verlangt', async () => {
    const quelle = createHttpMemosSource({
      baseUrl: BASE,
      fetch: async () => antwort({ message: 'x' }, { status: 401 }),
    });
    await expect(quelle.listPublicMemos()).rejects.toThrow(/PUBLIC/);
  });

  it('meldet Serverfehler, Netzfehler, kaputtes JSON und unerwartete Antworten', async () => {
    const fehler: Array<() => Promise<Response>> = [
      async () => antwort('x', { status: 500 }),
      async () => antwort('x', { status: 404 }),
      async () => {
        throw new TypeError('fetch failed');
      },
      async () => antwort('kein json'),
      async () => antwort({ foo: 1 }),
      async () => antwort([]),
    ];
    for (const f of fehler) {
      const quelle = createHttpMemosSource({ baseUrl: BASE, fetch: f });
      await expect(quelle.listPublicMemos()).rejects.toBeInstanceOf(MemosError);
    }
  });

  it('überspringt unbrauchbare Einträge mit Warnung, ohne alles zu verwerfen', async () => {
    const fetchMock = async () =>
      antwort({
        memos: [
          rohMemo('gut'),
          'text',
          { name: 'nope/1', content: 'x' },
          { name: 'memos/ohneinhalt' },
        ],
        nextPageToken: '',
      });
    const quelle = createHttpMemosSource({ baseUrl: BASE, fetch: fetchMock });
    const { memos, warnings } = await quelle.listPublicMemos();
    expect(memos.map((m) => m.name)).toEqual(['memos/gut']);
    expect(warnings.length).toBe(3);
  });

  it('akzeptiert nur http(s)-Adressen', () => {
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

describe('createHttpMemosSource: Anhänge', () => {
  const anhang = (
    extra: Partial<MemoAttachmentRaw> = {},
  ): MemoAttachmentRaw => ({
    name: 'attachments/abc123',
    filename: 'Bericht Final.pdf',
    type: 'application/pdf',
    size: '10',
    ...extra,
  });

  it('lädt über die Dateiroute ohne Anmeldung und ohne Weiterleitungen', async () => {
    const fetchMock = vi.fn(
      async () => new Response(Buffer.from('%PDF-1.4 hallo'), { status: 200 }),
    );
    const quelle = createHttpMemosSource({ baseUrl: BASE, fetch: fetchMock });
    const ergebnis = await quelle.fetchAttachment(anhang(), 1000);
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.data.toString()).toBe('%PDF-1.4 hallo');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      `${BASE}/file/attachments/abc123/${encodeURIComponent('Bericht Final.pdf')}`,
    );
    expect(init.redirect).toBe('manual');
  });

  it('meldet fehlende Dateien als not-found', async () => {
    const quelle = createHttpMemosSource({
      baseUrl: BASE,
      fetch: async () => antwort({}, { status: 404 }),
    });
    expect(await quelle.fetchAttachment(anhang(), 1000)).toMatchObject({
      ok: false,
      code: 'not-found',
    });
  });

  it('folgt keiner Weiterleitung', async () => {
    const quelle = createHttpMemosSource({
      baseUrl: BASE,
      fetch: async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'http://127.0.0.1/geheim' },
        }),
    });
    expect(await quelle.fetchAttachment(anhang(), 1000)).toMatchObject({
      ok: false,
      code: 'redirect',
    });
  });

  it('lehnt zu große Dateien schon am Header ab, ohne den Inhalt zu lesen', async () => {
    const quelle = createHttpMemosSource({
      baseUrl: BASE,
      fetch: async () =>
        new Response(Buffer.alloc(10), {
          status: 200,
          headers: { 'content-length': '5000' },
        }),
    });
    expect(await quelle.fetchAttachment(anhang(), 1000)).toMatchObject({
      ok: false,
      code: 'too-large',
    });
  });

  it('bricht beim Lesen ab, wenn der Inhalt das Limit überschreitet', async () => {
    const quelle = createHttpMemosSource({
      baseUrl: BASE,
      fetch: async () => new Response(Buffer.alloc(5000), { status: 200 }),
    });
    expect(await quelle.fetchAttachment(anhang(), 1000)).toMatchObject({
      ok: false,
      code: 'too-large',
    });
  });

  it('lehnt ungültige Anhangs-Kennungen ab, ohne etwas abzurufen', async () => {
    const fetchMock = vi.fn(async () => new Response('x'));
    const quelle = createHttpMemosSource({ baseUrl: BASE, fetch: fetchMock });
    for (const name of [
      'attachments/../x',
      'attachments/a/b',
      'foo/abc',
      'attachments/',
      'attachments/a b',
    ]) {
      expect(
        await quelle.fetchAttachment(anhang({ name }), 1000),
      ).toMatchObject({ ok: false, code: 'invalid' });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('wirft bei Anmeldepflicht, Serverfehler und Netzfehler, damit der Build abbricht', async () => {
    for (const f of [
      async () => antwort({}, { status: 401 }),
      async () => antwort({}, { status: 403 }),
      async () => antwort({}, { status: 500 }),
      async () => {
        throw new TypeError('fetch failed');
      },
    ]) {
      const quelle = createHttpMemosSource({ baseUrl: BASE, fetch: f });
      await expect(
        quelle.fetchAttachment(anhang(), 1000),
      ).rejects.toBeInstanceOf(MemosError);
    }
  });
});

/** Quelle mit festen Memos und Dateien, ohne Netz. */
function fakeQuelle(
  memos: MemoRaw[],
  dateien: Record<string, Buffer | FetchedAttachment> = {},
): MemosSource & { abgerufen: string[] } {
  const abgerufen: string[] = [];
  return {
    abgerufen,
    listPublicMemos: async () => ({ memos, warnings: [] }),
    fetchAttachment: async (anhang) => {
      abgerufen.push(anhang.name);
      const eintrag = dateien[anhang.name];
      if (eintrag === undefined)
        return { ok: false, code: 'not-found', reason: 'nicht gefunden' };
      return Buffer.isBuffer(eintrag) ? { ok: true, data: eintrag } : eintrag;
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

const anhangRoh = (
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

describe('buildMemoEntries: Grunddaten', () => {
  it('bildet Kennung, Datum, Titel aus Datum und Uhrzeit sowie Pfad', async () => {
    const quelle = fakeQuelle([
      rohMemo('abc', { content: 'Renovate eingerichtet.' }),
    ]);
    const { memos, warnings } = await buildMemoEntries(quelle, new Map());
    expect(warnings).toEqual([]);
    expect(memos).toHaveLength(1);
    const memo = memos[0];
    expect(memo?.uid).toBe('abc');
    expect(memo?.date.toISOString()).toBe('2026-11-02T13:32:00.000Z');
    expect(memo?.title).toBe('Memo vom 2. Nov. 2026, 14:32');
    expect(memo?.path).toBe('memos/abc');
    expect(memo?.html).toContain('<p>Renovate eingerichtet.</p>');
  });

  it('rechnet die Uhrzeit in Sommerzeit um', async () => {
    const quelle = fakeQuelle([
      rohMemo('s', { createTime: '2026-07-01T07:30:00Z' }),
    ]);
    const { memos } = await buildMemoEntries(quelle, new Map());
    expect(memos[0]?.title).toBe('Memo vom 1. Juli 2026, 09:30');
  });

  it('bildet die Beschreibung aus dem Text ohne Markdown und kürzt sie', async () => {
    const lang = `**Fett** und [Link](https://example.org) ${'wort '.repeat(80)}`;
    const quelle = fakeQuelle([rohMemo('d', { content: lang })]);
    const { memos } = await buildMemoEntries(quelle, new Map());
    const beschreibung = memos[0]?.description ?? '';
    expect(beschreibung.startsWith('Fett und Link wort')).toBe(true);
    expect(beschreibung.length).toBeLessThanOrEqual(161);
    expect(beschreibung.endsWith('…')).toBe(true);
    expect(beschreibung).not.toContain('*');
    expect(beschreibung).not.toContain('https');
  });

  it('kürzt die Beschreibung auf die eingestellte Länge', async () => {
    const quelle = fakeQuelle([rohMemo('d', { content: 'wort '.repeat(80) })]);
    const { memos } = await buildMemoEntries(quelle, new Map(), {
      descriptionChars: 40,
    });
    const beschreibung = memos[0]?.description ?? '';
    expect(beschreibung.length).toBeLessThanOrEqual(41);
    expect(beschreibung.endsWith('…')).toBe(true);
    expect(beschreibung.length).toBeGreaterThan(20);
  });

  it('lässt die Beschreibung leer, wenn es keinen Text gibt', async () => {
    const quelle = fakeQuelle([rohMemo('e', { content: '' })]);
    const { memos } = await buildMemoEntries(quelle, new Map());
    expect(memos[0]?.description).toBe('');
  });

  it('normalisiert Tags: klein, ohne #, doppelte fallen weg, verschachtelte bleiben ein Tag', async () => {
    const quelle = fakeQuelle([
      rohMemo('t', {
        tags: ['Tooling', '#Tooling', 'a/b', ' Über Größe ', ''],
      }),
    ]);
    const { memos } = await buildMemoEntries(quelle, new Map());
    expect(memos[0]?.tags).toEqual(['tooling', 'a/b', 'über größe']);
  });

  it('entfernt Eltern-Tags, die Memos aus verschachtelten Tags selbst erzeugt', async () => {
    // Memos liefert für "#a/b" die Tags "a" und "a/b" (belegt durch den Contract-Test).
    const quelle = fakeQuelle([
      rohMemo('v', { tags: ['contract', 'a', 'a/b'] }),
      rohMemo('w', { tags: ['x', 'x/y', 'x/y/z', 'andere'] }),
      rohMemo('u', { tags: ['a'] }),
      rohMemo('t', { tags: ['ab', 'a/b'] }),
    ]);
    const { memos } = await buildMemoEntries(quelle, new Map());
    const tags = Object.fromEntries(memos.map((m) => [m.uid, m.tags]));
    expect(tags.v).toEqual(['contract', 'a/b']);
    expect(tags.w).toEqual(['x/y/z', 'andere']);
    expect(tags.u).toEqual(['a']);
    expect(tags.t).toEqual(['ab', 'a/b']);
  });

  it('sortiert nach Datum, neueste zuerst', async () => {
    const quelle = fakeQuelle([
      rohMemo('alt', { createTime: '2026-01-01T10:00:00Z' }),
      rohMemo('neu', { createTime: '2026-03-01T10:00:00Z' }),
    ]);
    const { memos } = await buildMemoEntries(quelle, new Map());
    expect(memos.map((m) => m.uid)).toEqual(['neu', 'alt']);
  });

  it('überspringt nicht öffentliche, archivierte und Kommentar-Memos', async () => {
    const quelle = fakeQuelle([
      rohMemo('privat', { visibility: 'PRIVATE' }),
      rohMemo('geschuetzt', { visibility: 'PROTECTED' }),
      rohMemo('archiv', { state: 'ARCHIVED' }),
      rohMemo('kommentar', { parent: 'memos/abc' }),
      rohMemo('ok'),
    ]);
    const { memos, warnings } = await buildMemoEntries(quelle, new Map());
    expect(memos.map((m) => m.uid)).toEqual(['ok']);
    expect(warnings.some((w) => w.includes('privat'))).toBe(true);
    expect(warnings.some((w) => w.includes('geschuetzt'))).toBe(true);
  });

  it('überspringt Memos mit ungültigem Datum oder ungültiger Kennung', async () => {
    const quelle = fakeQuelle([
      rohMemo('datum', { createTime: 'gestern' }),
      rohMemo('../hack'),
      rohMemo('ok'),
    ]);
    const { memos, warnings } = await buildMemoEntries(quelle, new Map());
    expect(memos.map((m) => m.uid)).toEqual(['ok']);
    expect(warnings.length).toBe(2);
  });
});

describe('buildMemoEntries: Text bereinigen', () => {
  it('entfernt Skripte und fremde Bilder, auch freigegebene Hosts', async () => {
    const text =
      '<script>window.pwned=1</script>\n\n![x](https://upload.wikimedia.org/a.jpg)\n\nText';
    const quelle = fakeQuelle([rohMemo('s', { content: text })]);
    const { memos, warnings } = await buildMemoEntries(quelle, new Map());
    const html = memos[0]?.html ?? '';
    expect(html).not.toContain('<script');
    expect(html).not.toContain('wikimedia');
    expect(html).toContain('Text');
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('buildMemoEntries: Anhänge', () => {
  it('spiegelt Bilder als WebP mit Alt-Text aus dem Dateinamen und ohne Verweis auf die Instanz', async () => {
    const quelle = fakeQuelle(
      [
        rohMemo('b', {
          attachments: [
            anhangRoh('img1', 'IMG_2043.png', { type: 'image/png' }),
          ],
        }),
      ],
      { 'attachments/img1': await png() },
    );
    const speicher = new Map<string, Buffer>();
    const { memos, warnings } = await buildMemoEntries(quelle, speicher);
    expect(warnings).toEqual([]);
    const html = memos[0]?.html ?? '';
    expect(html).toMatch(/<img [^>]*src="\/media\/[0-9a-f]{16}-480\.webp"/);
    expect(html).toContain('srcset="/media/');
    expect(html).toContain('alt="IMG 2043"');
    expect(html).not.toContain('memos.test');
    expect(html).not.toContain('/file/attachments');
    expect([...speicher.keys()].every((k) => k.endsWith('.webp'))).toBe(true);
    expect(speicher.size).toBeGreaterThan(0);
  });

  it('spiegelt PDF, Audio und Video mit passendem Element', async () => {
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
    const quelle = fakeQuelle(
      [
        rohMemo('m', {
          attachments: [
            anhangRoh('p1', 'Mein Bericht.PDF'),
            anhangRoh('a1', 'Klang.wav'),
            anhangRoh('v1', 'Film.mp4'),
          ],
        }),
      ],
      {
        'attachments/p1': Buffer.from('%PDF-1.4\nhallo'),
        'attachments/a1': wav,
        'attachments/v1': mp4,
      },
    );
    const speicher = new Map<string, Buffer>();
    const { memos, warnings } = await buildMemoEntries(quelle, speicher);
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
      [...speicher.keys()].map((k) => k.replace(/^[0-9a-f]{16}-/, '')).sort(),
    ).toEqual(['film.mp4', 'klang.wav', 'mein-bericht.pdf']);
  });

  it('maskiert Dateinamen im HTML', async () => {
    const quelle = fakeQuelle(
      [rohMemo('x', { attachments: [anhangRoh('p', '<b>x</b>&"y.pdf')] })],
      {
        'attachments/p': Buffer.from('%PDF-1.4'),
      },
    );
    const { memos } = await buildMemoEntries(quelle, new Map());
    const html = memos[0]?.html ?? '';
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;&amp;&quot;y.pdf');
  });

  it('überspringt nicht erlaubte Dateitypen mit Warnung und lädt sie nicht', async () => {
    const quelle = fakeQuelle(
      [
        rohMemo('o', {
          attachments: [
            anhangRoh('h', 'seite.html'),
            anhangRoh('s', 'logo.svg'),
            anhangRoh('z', 'archiv.zip'),
            anhangRoh('e', 'prog.exe'),
            anhangRoh('i', 'foto.heic'),
          ],
        }),
      ],
      {},
    );
    const { memos, warnings } = await buildMemoEntries(quelle, new Map());
    expect(quelle.abgerufen).toEqual([]);
    expect(memos[0]?.html).not.toMatch(/<(a|img|audio|video)\b/);
    expect(warnings).toHaveLength(5);
    expect(warnings.find((w) => w.includes('foto.heic'))).toMatch(/HEIC/i);
  });

  it('weist Dateien ab, deren Inhalt nicht zur Endung passt', async () => {
    const quelle = fakeQuelle(
      [rohMemo('f', { attachments: [anhangRoh('p', 'falsch.pdf')] })],
      {
        'attachments/p': Buffer.from(
          '<!doctype html><script>alert(1)</script>',
        ),
      },
    );
    const speicher = new Map<string, Buffer>();
    const { memos, warnings } = await buildMemoEntries(quelle, speicher);
    expect(memos[0]?.html).not.toContain('falsch.pdf');
    expect(speicher.size).toBe(0);
    expect(warnings).toHaveLength(1);
  });

  it('weist Bilder ab, die sich nicht lesen lassen', async () => {
    const quelle = fakeQuelle(
      [rohMemo('k', { attachments: [anhangRoh('i', 'kaputt.png')] })],
      {
        'attachments/i': Buffer.from('kein Bild'),
      },
    );
    const { memos, warnings } = await buildMemoEntries(quelle, new Map());
    expect(memos[0]?.html).not.toContain('<img');
    expect(warnings).toHaveLength(1);
  });

  it('übergeht externe Anhänge, weil nichts von fremden Diensten geladen wird', async () => {
    const quelle = fakeQuelle([
      rohMemo('x', {
        attachments: [
          anhangRoh('e', 'bild.png', {
            externalLink: 'https://s3.example/bild.png',
          }),
        ],
      }),
    ]);
    const { memos, warnings } = await buildMemoEntries(quelle, new Map());
    expect(quelle.abgerufen).toEqual([]);
    expect(memos[0]?.html).not.toContain('s3.example');
    expect(warnings).toHaveLength(1);
  });

  it('lässt das Memo stehen und warnt, wenn ein Anhang fehlt oder zu groß ist', async () => {
    const quelle = fakeQuelle(
      [
        rohMemo('g', {
          content: 'Text bleibt',
          attachments: [anhangRoh('weg', 'a.pdf'), anhangRoh('gross', 'b.pdf')],
        }),
      ],
      {
        'attachments/gross': {
          ok: false,
          code: 'too-large',
          reason: 'zu groß',
        },
      },
    );
    const { memos, warnings } = await buildMemoEntries(quelle, new Map());
    expect(memos).toHaveLength(1);
    expect(memos[0]?.html).toContain('Text bleibt');
    expect(warnings).toHaveLength(2);
  });

  it('bricht den ganzen Build ab, wenn der Abruf eines Anhangs vorübergehend scheitert', async () => {
    const quelle: MemosSource = {
      listPublicMemos: async () => ({
        memos: [rohMemo('h', { attachments: [anhangRoh('p', 'a.pdf')] })],
        warnings: [],
      }),
      fetchAttachment: async () => {
        throw new MemosError('Netzwerkfehler');
      },
    };
    await expect(buildMemoEntries(quelle, new Map())).rejects.toBeInstanceOf(
      MemosError,
    );
  });

  it('bricht ab, wenn die Liste nicht geladen werden kann', async () => {
    const quelle: MemosSource = {
      listPublicMemos: async () => {
        throw new MemosError('nicht erreichbar');
      },
      fetchAttachment: async () => ({
        ok: false,
        code: 'not-found',
        reason: '',
      }),
    };
    await expect(buildMemoEntries(quelle, new Map())).rejects.toThrow(
      'nicht erreichbar',
    );
  });

  it('verarbeitet gleiche Dateien nur einmal im Speicher', async () => {
    const bild = await png(300, 200);
    const quelle = fakeQuelle(
      [
        rohMemo('a', { attachments: [anhangRoh('i1', 'a.png')] }),
        rohMemo('b', { attachments: [anhangRoh('i2', 'b.png')] }),
      ],
      { 'attachments/i1': bild, 'attachments/i2': bild },
    );
    const speicher = new Map<string, Buffer>();
    await buildMemoEntries(quelle, speicher);
    expect(speicher.size).toBe(1);
  });
});
