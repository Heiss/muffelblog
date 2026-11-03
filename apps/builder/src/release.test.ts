import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  realpath,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  pruneReleases,
  releaseId,
  runRelease,
  swapCurrent,
  writeBuildJson,
} from './release.ts';
import type { Step } from './release.ts';

async function tmp(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'muffel-rel-'));
}

describe('releaseId', () => {
  it('is sortable and safe as a folder name', () => {
    const id = releaseId(new Date('2026-11-03T18:05:09.123Z'));
    expect(id).toBe('20261103T180509Z');
    expect(id).toMatch(/^[0-9A-Z]+$/);
  });
});

describe('swapCurrent', () => {
  it('points current at a release with a relative link', async () => {
    const root = await tmp();
    await mkdir(path.join(root, 'a'));
    await swapCurrent(root, 'a');
    expect(await readlink(path.join(root, 'current'))).toBe('a');
  });

  it('replaces an existing link without a gap', async () => {
    const root = await tmp();
    await mkdir(path.join(root, 'a'));
    await mkdir(path.join(root, 'b'));
    await writeFile(path.join(root, 'a', 'x'), 'A');
    await writeFile(path.join(root, 'b', 'x'), 'B');
    await swapCurrent(root, 'a');
    await swapCurrent(root, 'b');
    expect(await readFile(path.join(root, 'current', 'x'), 'utf8')).toBe('B');
    expect((await readdir(root)).filter((n) => n.startsWith('.'))).toEqual([]);
  });

  it('refuses a release that does not exist', async () => {
    const root = await tmp();
    await expect(swapCurrent(root, 'missing')).rejects.toThrow(/missing/);
  });

  it('refuses names that leave the folder', async () => {
    const root = await tmp();
    await expect(swapCurrent(root, '../x')).rejects.toThrow();
  });
});

describe('pruneReleases', () => {
  it('keeps the newest ones and the current one', async () => {
    const root = await tmp();
    for (const id of ['1', '2', '3', '4', '5']) {
      await mkdir(path.join(root, id));
    }
    await swapCurrent(root, '2');
    await pruneReleases(root, 2);
    const left = (await readdir(root)).sort();
    expect(left).toEqual(['2', '4', '5', 'current']);
  });

  it('never touches files and ignores the link itself', async () => {
    const root = await tmp();
    await mkdir(path.join(root, '1'));
    await writeFile(path.join(root, 'notes.txt'), 'x');
    await swapCurrent(root, '1');
    await pruneReleases(root, 1);
    expect((await readdir(root)).sort()).toEqual(['1', 'current', 'notes.txt']);
  });
});

describe('writeBuildJson', () => {
  it('writes id and time', async () => {
    const dir = await tmp();
    await writeBuildJson(dir, 'abc', new Date('2026-11-03T18:05:09Z'));
    expect(
      JSON.parse(await readFile(path.join(dir, 'build.json'), 'utf8')),
    ).toEqual({
      id: 'abc',
      builtAt: '2026-11-03T18:05:09.000Z',
    });
  });
});

describe('runRelease', () => {
  const now = new Date('2026-11-03T18:05:09Z');

  it('builds, indexes, writes build.json last, then swaps', async () => {
    const root = await tmp();
    const order: string[] = [];
    const steps: Step[] = [
      async (dir) => {
        order.push('site');
        await writeFile(path.join(dir, 'index.html'), 'x');
      },
      async (dir) => {
        order.push('index');
        expect(await readdir(dir)).toContain('index.html');
        expect(await readdir(dir)).not.toContain('build.json');
      },
    ];
    const id = await runRelease({ root, steps, keep: 3, now });
    expect(id).toBe('20261103T180509Z');
    expect(order).toEqual(['site', 'index']);
    expect(await readlink(path.join(root, 'current'))).toBe(id);
    expect(await readdir(path.join(root, 'current'))).toContain('build.json');
  });

  it('keeps the last good version online when a step fails', async () => {
    const root = await tmp();
    const ok: Step[] = [
      async (dir) => writeFile(path.join(dir, 'index.html'), 'ok'),
    ];
    const first = await runRelease({ root, steps: ok, keep: 3, now });
    const bad: Step[] = [
      async (dir) => {
        await writeFile(path.join(dir, 'index.html'), 'half');
        throw new Error('fetch failed');
      },
    ];
    await expect(
      runRelease({
        root,
        steps: bad,
        keep: 3,
        now: new Date('2026-11-03T19:00:00Z'),
      }),
    ).rejects.toThrow('fetch failed');
    expect(await readlink(path.join(root, 'current'))).toBe(first);
    // The half-built folder is removed.
    expect((await readdir(root)).sort()).toEqual([first, 'current'].sort());
    expect((await lstat(path.join(root, 'current'))).isSymbolicLink()).toBe(
      true,
    );
    expect(await realpath(path.join(root, 'current'))).toBe(
      await realpath(path.join(root, first)),
    );
  });

  it('never overwrites or removes an existing release with the same id', async () => {
    const root = await tmp();
    const steps: Step[] = [
      async (dir) => writeFile(path.join(dir, 'i'), 'good'),
    ];
    const first = await runRelease({ root, steps, keep: 3, now });
    await expect(
      runRelease({
        root,
        steps: [
          async () => {
            throw new Error('x');
          },
        ],
        keep: 3,
        now,
      }),
    ).rejects.toThrow(/already exists/);
    expect(await readFile(path.join(root, first, 'i'), 'utf8')).toBe('good');
  });

  it('prunes old releases after the swap', async () => {
    const root = await tmp();
    const steps: Step[] = [async (dir) => writeFile(path.join(dir, 'i'), 'x')];
    for (let i = 0; i < 4; i++) {
      await runRelease({
        root,
        steps,
        keep: 2,
        now: new Date(Date.UTC(2026, 10, 3, 18, i)),
      });
    }
    const left = (await readdir(root)).filter((n) => n !== 'current');
    expect(left).toHaveLength(2);
  });
});
