import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildMemoEntries, createHttpMemosSource } from '../src/memos.ts';

/**
 * Contract-Test gegen eine echte Memos-Instanz (frisch, ohne Daten).
 * Läuft nur mit MEMOS_CONTRACT_URL, zum Beispiel http://localhost:5230.
 * Er legt den ersten Benutzer an, stellt den Zugriff auf PUBLIC, erzeugt
 * Memos und prüft, dass der Loader sie ohne Anmeldung korrekt liest.
 */
const BASIS = process.env.MEMOS_CONTRACT_URL;
const PASSWORT = 'contract-test-passwort-123';

async function anfrage(
  pfad: string,
  optionen: { method?: string; body?: unknown; token?: string } = {},
): Promise<{ status: number; json: Record<string, unknown>; text: string }> {
  const antwort = await fetch(`${BASIS}${pfad}`, {
    method: optionen.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(optionen.token ? { authorization: `Bearer ${optionen.token}` } : {}),
    },
    body:
      optionen.body === undefined ? undefined : JSON.stringify(optionen.body),
  });
  const text = await antwort.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // Antwort ohne JSON, der Text steht in der Fehlermeldung.
  }
  return { status: antwort.status, json, text };
}

function erwarteOk(
  antwort: { status: number; text: string },
  was: string,
): void {
  if (antwort.status < 200 || antwort.status >= 300) {
    throw new Error(
      `${was}: HTTP ${antwort.status}, Antwort: ${antwort.text.slice(0, 500)}`,
    );
  }
}

async function warteAufInstanz(): Promise<void> {
  const ende = Date.now() + 120_000;
  let letzter = '';
  while (Date.now() < ende) {
    try {
      const antwort = await fetch(`${BASIS}/healthz`);
      if (antwort.ok) return;
      letzter = `HTTP ${antwort.status}`;
    } catch (fehler) {
      letzter = fehler instanceof Error ? fehler.message : String(fehler);
    }
    await new Promise((fertig) => setTimeout(fertig, 2000));
  }
  throw new Error(`Memos wurde nicht bereit (${letzter})`);
}

describe.skipIf(!BASIS)('Memos (echte Instanz)', () => {
  let oeffentlicheUid = '';
  let anhangName = '';

  beforeAll(async () => {
    await warteAufInstanz();

    const neu = await anfrage('/api/users', {
      method: 'POST',
      body: { username: 'ci', password: PASSWORT, displayName: 'CI' },
    });
    // Läuft der Test erneut gegen dieselbe Instanz, existiert der Benutzer schon.
    if (neu.status < 200 || neu.status >= 300)
      console.warn(
        `Benutzer anlegen: HTTP ${neu.status} ${neu.text.slice(0, 200)}`,
      );

    const login = await anfrage('/api/auth/signin', {
      method: 'POST',
      body: { passwordCredentials: { username: 'ci', password: PASSWORT } },
    });
    erwarteOk(login, 'Anmelden');
    const token = String(login.json.accessToken ?? '');
    expect(token).not.toBe('');

    const modus = await anfrage('/api/instance/settings/ACCESS', {
      method: 'PATCH',
      token,
      body: {
        name: 'instance/settings/ACCESS',
        accessSetting: { accessMode: 'INSTANCE_ACCESS_MODE_PUBLIC' },
      },
    });
    erwarteOk(modus, 'Zugriffsmodus auf PUBLIC stellen');

    const bild = await sharp({
      create: {
        width: 640,
        height: 320,
        channels: 3,
        background: { r: 30, g: 120, b: 200 },
      },
    })
      .png()
      .toBuffer();
    const anhang = await anfrage('/api/attachments', {
      method: 'POST',
      token,
      body: {
        filename: 'IMG_CI.png',
        type: 'image/png',
        content: bild.toString('base64'),
      },
    });
    erwarteOk(anhang, 'Anhang hochladen');
    anhangName = String(anhang.json.name ?? '');
    expect(anhangName).toMatch(/^attachments\//);

    const oeffentlich = await anfrage('/api/memos', {
      method: 'POST',
      token,
      body: {
        content: 'Contract-Test: öffentliches Memo #contract #a/b',
        visibility: 'PUBLIC',
        attachments: [{ name: anhangName }],
      },
    });
    erwarteOk(oeffentlich, 'Öffentliches Memo anlegen');
    oeffentlicheUid = String(oeffentlich.json.name ?? '').replace(
      /^memos\//,
      '',
    );
    expect(oeffentlicheUid).not.toBe('');

    for (const sichtbarkeit of ['PRIVATE', 'PROTECTED']) {
      const memo = await anfrage('/api/memos', {
        method: 'POST',
        token,
        body: {
          content: `Contract-Test: ${sichtbarkeit} darf nie erscheinen`,
          visibility: sichtbarkeit,
        },
      });
      erwarteOk(memo, `${sichtbarkeit}-Memo anlegen`);
    }
  }, 180_000);

  it('liefert die Liste ohne Anmeldung als JSON mit den erwarteten Feldnamen', async () => {
    const url = new URL(`${BASIS}/api/memos`);
    url.searchParams.set('page_size', '100');
    url.searchParams.set('filter', 'visibility == "PUBLIC"');
    url.searchParams.set('order_by', 'create_time desc');
    const antwort = await fetch(url);
    expect(antwort.status).toBe(200);
    const json = (await antwort.json()) as Record<string, unknown>;
    expect(Array.isArray(json.memos)).toBe(true);
    expect(typeof json.nextPageToken).toBe('string');
    const memo = (json.memos as Array<Record<string, unknown>>)[0] ?? {};
    for (const feld of [
      'name',
      'content',
      'visibility',
      'createTime',
      'attachments',
      'tags',
    ]) {
      expect(Object.keys(memo), `Feld ${feld}`).toContain(feld);
    }
  });

  it('der Loader sieht nur das öffentliche Memo samt Anhang und Tags', async () => {
    const quelle = createHttpMemosSource({ baseUrl: BASIS as string });
    const { memos, warnings } = await quelle.listPublicMemos();
    expect(warnings).toEqual([]);
    expect(memos.map((m) => m.name)).toEqual([`memos/${oeffentlicheUid}`]);
    const memo = memos[0];
    expect(memo?.visibility).toBe('PUBLIC');
    expect(memo?.content).toContain('öffentliches Memo');
    expect(memo?.tags).toContain('contract');
    console.info(`Von Memos gelieferte Tags: ${JSON.stringify(memo?.tags)}`);
    expect(memo?.attachments?.map((a) => a.filename)).toEqual(['IMG_CI.png']);
    expect(memo?.attachments?.[0]?.name).toBe(anhangName);
  });

  it('der Loader lädt den Anhang ohne Anmeldung über die Dateiroute', async () => {
    const quelle = createHttpMemosSource({ baseUrl: BASIS as string });
    const { memos } = await quelle.listPublicMemos();
    const anhang = memos[0]?.attachments?.[0];
    expect(anhang).toBeDefined();
    const geholt = await quelle.fetchAttachment(
      anhang as NonNullable<typeof anhang>,
      5_000_000,
    );
    expect(geholt).toMatchObject({ ok: true });
    if (!geholt.ok) return;
    expect((await sharp(geholt.data).metadata()).format).toBe('png');
  });

  it('baut daraus eine Seite ohne Verweis auf die Instanz', async () => {
    const quelle = createHttpMemosSource({ baseUrl: BASIS as string });
    const speicher = new Map<string, Buffer>();
    const { memos, warnings } = await buildMemoEntries(quelle, speicher);
    expect(warnings).toEqual([]);
    expect(memos).toHaveLength(1);
    const html = memos[0]?.html ?? '';
    expect(html).toContain('öffentliches Memo');
    expect(html).toMatch(/<img [^>]*alt="IMG CI"/);
    expect(html).not.toContain(String(BASIS));
    expect(html).not.toContain('/file/attachments');
    expect(speicher.size).toBeGreaterThan(0);
  });

  it('meldet bei nicht erreichbarer Instanz einen Fehler statt einer leeren Liste', async () => {
    const quelle = createHttpMemosSource({
      baseUrl: 'http://127.0.0.1:9',
      timeoutMs: 3000,
    });
    await expect(quelle.listPublicMemos()).rejects.toThrow();
  });
});
