import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileStore, sourcesFrom } from './serve.ts';

describe('fileStore', () => {
  it('returns an empty state when nothing was saved or the file is broken', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'muffel-store-'));
    expect(await fileStore(dir).loadState()).toEqual({});
  });

  it('saves and loads the built marker', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'muffel-store-'));
    const store = fileStore(dir);
    await store.saveState({ builtMarker: 'abc' });
    expect(await store.loadState()).toEqual({ builtMarker: 'abc' });
  });

  it('writes the status as readable JSON', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'muffel-store-'));
    await fileStore(dir).writeStatus({
      state: 'ok',
      lastCheck: '2026-11-04T10:00:00Z',
    });
    expect(
      JSON.parse(await readFile(path.join(dir, 'status.json'), 'utf8')),
    ).toEqual({
      state: 'ok',
      lastCheck: '2026-11-04T10:00:00Z',
    });
  });
});

describe('sourcesFrom', () => {
  it('uses the sample content when MUFFEL_FIXTURES is set', () => {
    expect(sourcesFrom({ MUFFEL_FIXTURES: 'demo' })).toEqual({
      mode: 'demo',
      nextcloud: false,
    });
  });

  it('uses Nextcloud and Memos for real content', () => {
    expect(
      sourcesFrom({
        NEXTCLOUD_URL: 'https://c.example',
        MEMOS_URL: 'https://m.example',
      }),
    ).toEqual({
      mode: 'real',
      nextcloud: true,
    });
  });

  it('accepts a folder instead of Nextcloud', () => {
    expect(
      sourcesFrom({
        CONTENT_DIR: '/data/content',
        MEMOS_URL: 'https://m.example',
      }),
    ).toEqual({
      mode: 'real',
      nextcloud: false,
    });
  });

  it('stops at the start when a source is missing', () => {
    expect(() => sourcesFrom({})).toThrow(/No content source/);
    expect(() => sourcesFrom({ NEXTCLOUD_URL: 'https://c.example' })).toThrow(
      /MEMOS_URL/,
    );
    expect(() =>
      sourcesFrom({ MUFFEL_FIXTURES: '', MEMOS_URL: 'https://m.example' }),
    ).toThrow(/No content source/);
  });
});
