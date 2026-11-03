import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildMemoEntries, createFixtureMemosSource } from './memos.ts';

const folder = fileURLToPath(new URL('../fixtures/memos', import.meta.url));

describe('Memos fixtures', () => {
  it('returns exactly the public, displayable memos, newest first', async () => {
    const store = new Map<string, Buffer>();
    const { memos } = await buildMemoEntries(
      createFixtureMemosSource(folder),
      store,
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

  it('reports skipped memos and attachments without losing anything', async () => {
    const { warnings } = await buildMemoEntries(
      createFixtureMemosSource(folder),
      new Map(),
    );
    const text = warnings.join('\n');
    expect(text).toContain('memo-privat');
    expect(text).toContain('extern.png');
    expect(text).toContain('seite.html');
    expect(text).toContain('wikimedia');
  });

  it('mirrors image, PDF and audio, but nothing else', async () => {
    const store = new Map<string, Buffer>();
    await buildMemoEntries(createFixtureMemosSource(folder), store);
    const names = [...store.keys()]
      .map((k) => k.replace(/^[0-9a-f]{16}-/, ''))
      .sort();
    expect(names).toEqual([
      '480.webp',
      '960.webp',
      'klang.wav',
      'mein-bericht.pdf',
    ]);
  });

  it('throws if memos.json is missing', async () => {
    await expect(
      createFixtureMemosSource(`${folder}/gibt-es-nicht`).listPublicMemos(),
    ).rejects.toThrow();
  });

  it('rejects path tricks in attachments', async () => {
    const source = createFixtureMemosSource(folder);
    for (const filename of ['../memos.json', 'a/b.pdf', '.versteckt.pdf']) {
      expect(
        await source.fetchAttachment(
          { name: 'attachments/pdf-1', filename, type: '' },
          1000,
        ),
      ).toMatchObject({
        ok: false,
        code: 'invalid',
      });
    }
    expect(
      await source.fetchAttachment(
        { name: 'attachments/..', filename: 'x.pdf', type: '' },
        1000,
      ),
    ).toMatchObject({ ok: false, code: 'invalid' });
  });
});
