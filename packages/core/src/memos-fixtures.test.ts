import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildMemoEntries, createFixtureMemosSource } from './memos.ts';

const ordner = fileURLToPath(new URL('../fixtures/memos', import.meta.url));

describe('Memos-Fixtures', () => {
  it('liefert genau die öffentlichen, darstellbaren Memos, neueste zuerst', async () => {
    const speicher = new Map<string, Buffer>();
    const { memos } = await buildMemoEntries(
      createFixtureMemosSource(ordner),
      speicher,
    );
    expect(memos.map((m) => m.uid)).toEqual([
      'memo-text',
      'memo-bild',
      'memo-dateien',
      'memo-skript',
      'memo-extern',
      'memo-html',
    ]);
  });

  it('meldet übersprungene Memos und Anhänge, ohne etwas zu verlieren', async () => {
    const { warnings } = await buildMemoEntries(
      createFixtureMemosSource(ordner),
      new Map(),
    );
    const text = warnings.join('\n');
    expect(text).toContain('memo-privat');
    expect(text).toContain('extern.png');
    expect(text).toContain('seite.html');
    expect(text).toContain('wikimedia');
  });

  it('spiegelt Bild, PDF und Audio, aber sonst nichts', async () => {
    const speicher = new Map<string, Buffer>();
    await buildMemoEntries(createFixtureMemosSource(ordner), speicher);
    const namen = [...speicher.keys()]
      .map((k) => k.replace(/^[0-9a-f]{16}-/, ''))
      .sort();
    expect(namen).toEqual([
      '480.webp',
      '960.webp',
      'klang.wav',
      'mein-bericht.pdf',
    ]);
  });

  it('wirft, wenn memos.json fehlt', async () => {
    await expect(
      createFixtureMemosSource(`${ordner}/gibt-es-nicht`).listPublicMemos(),
    ).rejects.toThrow();
  });

  it('weist Pfadtricks bei Anhängen ab', async () => {
    const quelle = createFixtureMemosSource(ordner);
    for (const filename of ['../memos.json', 'a/b.pdf', '.versteckt.pdf']) {
      expect(
        await quelle.fetchAttachment(
          { name: 'attachments/pdf-1', filename, type: '' },
          1000,
        ),
      ).toMatchObject({
        ok: false,
        code: 'invalid',
      });
    }
    expect(
      await quelle.fetchAttachment(
        { name: 'attachments/..', filename: 'x.pdf', type: '' },
        1000,
      ),
    ).toMatchObject({ ok: false, code: 'invalid' });
  });
});
