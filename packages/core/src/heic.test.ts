import { readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  createHeifConverter,
  heifAvailable,
  isHeic,
  type HeicRunner,
} from './heic.ts';

const sample = readFile(
  new URL('../fixtures/heic/sample.heic', import.meta.url),
);

const jpeg = () =>
  sharp({
    create: { width: 8, height: 6, channels: 3, background: '#336699' },
  })
    .jpeg()
    .toBuffer();

/** A stand-in for heif-convert: writes the file that the real tool would write. */
function fakeRunner(
  write: (outPath: string) => Promise<void>,
  seen: { args?: string[]; timeoutMs?: number; cwd?: string } = {},
): HeicRunner {
  return async (_command, args, options) => {
    seen.args = args;
    seen.timeoutMs = options.timeoutMs;
    seen.cwd = options.cwd;
    await write(args[args.length - 1] as string);
  };
}

describe('isHeic', () => {
  it('knows the real sample and the HEIC brands', async () => {
    expect(isHeic(await sample)).toBe(true);
    for (const brand of [
      'heic',
      'heix',
      'hevc',
      'hevx',
      'heim',
      'heis',
      'mif1',
      'msf1',
    ]) {
      const data = Buffer.concat([
        Buffer.from([0, 0, 0, 0x18]),
        Buffer.from(`ftyp${brand}`),
        Buffer.alloc(12),
      ]);
      expect(isHeic(data), brand).toBe(true);
    }
  });

  it('does not take other files for HEIC', async () => {
    expect(isHeic(await jpeg())).toBe(false);
    expect(isHeic(Buffer.from('ftypheic'))).toBe(false); // too short, wrong position
    expect(isHeic(Buffer.alloc(0))).toBe(false);
    const mp4 = Buffer.concat([
      Buffer.from([0, 0, 0, 0x18]),
      Buffer.from('ftypisom'),
      Buffer.alloc(12),
    ]);
    expect(isHeic(mp4)).toBe(false);
    const avif = Buffer.concat([
      Buffer.from([0, 0, 0, 0x18]),
      Buffer.from('ftypavif'),
      Buffer.alloc(12),
    ]);
    expect(isHeic(avif)).toBe(false);
  });
});

describe('createHeifConverter', () => {
  it('runs the tool on a file in a folder of its own and returns the JPEG', async () => {
    const seen: { args?: string[]; timeoutMs?: number; cwd?: string } = {};
    const out = await jpeg();
    const convert = createHeifConverter({
      timeoutMs: 1234,
      run: fakeRunner((p) => writeFile(p, out), seen),
    });
    const result = await convert(await sample);
    expect(result.equals(out)).toBe(true);
    expect(seen.timeoutMs).toBe(1234);
    expect(seen.args?.[0]).toBe('-q');
    expect(path.basename(seen.args?.at(-2) ?? '')).toBe('in.heic');
    expect(seen.cwd?.startsWith(os.tmpdir())).toBe(true);
  });

  it('removes the folder afterwards, on success and on failure', async () => {
    const before = (await readdir(os.tmpdir())).filter((n) =>
      n.startsWith('heic-'),
    );
    const dirs: string[] = [];
    const run: HeicRunner = async (_c, args, options) => {
      dirs.push(options.cwd);
      if (args.includes('fail')) throw new Error('boom');
      await writeFile(args[args.length - 1] as string, await jpeg());
    };
    await createHeifConverter({ run })(await sample);
    await expect(
      createHeifConverter({
        run: async (c, a, o) => {
          dirs.push(o.cwd);
          throw new Error('tool failed');
        },
      })(await sample),
    ).rejects.toThrow(/tool failed/);
    const after = (await readdir(os.tmpdir())).filter((n) =>
      n.startsWith('heic-'),
    );
    expect(after.sort()).toEqual(before.sort());
    expect(dirs).toHaveLength(2);
  });

  it('refuses a file that is no HEIC, without running the tool', async () => {
    let ran = false;
    const convert = createHeifConverter({
      run: async () => {
        ran = true;
      },
    });
    await expect(convert(await jpeg())).rejects.toThrow(/not a HEIC/i);
    expect(ran).toBe(false);
  });

  it('refuses an input that is too large, without running the tool', async () => {
    let ran = false;
    const convert = createHeifConverter({
      maxInputBytes: 100,
      run: async () => {
        ran = true;
      },
    });
    const big = Buffer.concat([await sample, Buffer.alloc(200)]);
    await expect(convert(big)).rejects.toThrow(/too large/i);
    expect(ran).toBe(false);
  });

  it('fails when the tool writes nothing, something that is no JPEG, or too much', async () => {
    const none = createHeifConverter({ run: fakeRunner(async () => {}) });
    await expect(none(await sample)).rejects.toThrow(/no output/i);

    const notJpeg = createHeifConverter({
      run: fakeRunner((p) => writeFile(p, Buffer.from('this is not a jpeg'))),
    });
    await expect(notJpeg(await sample)).rejects.toThrow(/not a JPEG/i);

    const huge = createHeifConverter({
      maxOutputBytes: 10,
      run: fakeRunner(async (p) => writeFile(p, await jpeg())),
    });
    await expect(huge(await sample)).rejects.toThrow(/too large/i);
  });

  it('takes the first file if the tool wrote one per image', async () => {
    const out = await jpeg();
    const convert = createHeifConverter({
      run: fakeRunner((p) => writeFile(p.replace(/\.jpg$/, '-1.jpg'), out)),
    });
    expect((await convert(await sample)).equals(out)).toBe(true);
  });

  it('passes the failure of the tool on, also a time out', async () => {
    const convert = createHeifConverter({
      run: async () => {
        throw Object.assign(new Error('Command timed out'), { killed: true });
      },
    });
    await expect(convert(await sample)).rejects.toThrow(/timed out/i);
  });
});

describe('heifAvailable', () => {
  it('is false when the program does not exist and true otherwise', async () => {
    const missing: HeicRunner = async () => {
      throw Object.assign(new Error('spawn x ENOENT'), { code: 'ENOENT' });
    };
    expect(await heifAvailable('heif-convert', missing)).toBe(false);
    const present: HeicRunner = async () => {};
    expect(await heifAvailable('heif-convert', present)).toBe(true);
    // a program that exists but exits with an error for --version still exists
    const exits: HeicRunner = async () => {
      throw Object.assign(new Error('exit 1'), { code: 1 });
    };
    expect(await heifAvailable('heif-convert', exits)).toBe(true);
  });
});
