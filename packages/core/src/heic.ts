import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** Turns a HEIC photo (iPhone) into a JPEG. Throws if it cannot. */
export type HeicConverter = (input: Buffer) => Promise<Buffer>;

/** Runs the tool. Injectable, so the tests do not need libheif. */
export type HeicRunner = (
  command: string,
  args: string[],
  options: { timeoutMs: number; cwd: string },
) => Promise<void>;

const BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'mif1',
  'msf1',
]);

/**
 * True if the data is an ISO base media file of a HEIC brand ("ftyp" at byte 4
 * and a brand of HEIC or HEIF). The extension alone is never trusted.
 */
export function isHeic(data: Buffer): boolean {
  if (data.length < 12) return false;
  if (data.toString('latin1', 4, 8) !== 'ftyp') return false;
  return BRANDS.has(data.toString('latin1', 8, 12));
}

const defaultRun: HeicRunner = (command, args, options) =>
  new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        cwd: options.cwd,
        timeout: options.timeoutMs,
        killSignal: 'SIGKILL',
        maxBuffer: 1024 * 1024,
        // Nothing of the environment of the build goes to the tool.
        env: { PATH: process.env.PATH ?? '' },
      },
      (error) => (error ? reject(error) : resolve()),
    );
  });

export interface HeifOptions {
  /** `heif-convert` of the package `libheif-examples`. */
  command?: string;
  /** Time limit for one conversion, in milliseconds. */
  timeoutMs?: number;
  maxInputBytes?: number;
  maxOutputBytes?: number;
  /** JPEG quality, 1 to 100. */
  quality?: number;
  run?: HeicRunner;
}

const MB = 1024 * 1024;

/**
 * Converts with `heif-convert` (libheif). The file is written to a folder of its
 * own, converted by the tool under a time limit, and read back; the folder is
 * removed in every case. Input and output are checked: the input must be a HEIC
 * file and not larger than the limit, the output must be a JPEG and not larger
 * than the limit.
 */
export function createHeifConverter(options: HeifOptions = {}): HeicConverter {
  const command = options.command ?? 'heif-convert';
  const timeoutMs = options.timeoutMs ?? 20_000;
  const maxInput = options.maxInputBytes ?? 25 * MB;
  const maxOutput = options.maxOutputBytes ?? 50 * MB;
  const quality = options.quality ?? 90;
  const run = options.run ?? defaultRun;

  return async (input) => {
    if (!isHeic(input)) throw new Error('The file is not a HEIC photo');
    if (input.length > maxInput)
      throw new Error('The HEIC photo is too large to convert');
    const dir = await mkdtemp(path.join(os.tmpdir(), 'heic-'));
    try {
      const source = path.join(dir, 'in.heic');
      const target = path.join(dir, 'out.jpg');
      await writeFile(source, input);
      await run(command, ['-q', String(quality), source, target], {
        timeoutMs,
        cwd: dir,
      });
      // One file per image if the photo holds several: the first one counts.
      const written = (await readdir(dir))
        .filter((name) => name.startsWith('out') && name.endsWith('.jpg'))
        .sort();
      const first = written[0];
      if (first === undefined) throw new Error('heif-convert wrote no output');
      const output = await readFile(path.join(dir, first));
      if (output.length > maxOutput)
        throw new Error('The converted photo is too large');
      if (!(output[0] === 0xff && output[1] === 0xd8 && output[2] === 0xff))
        throw new Error('The output of heif-convert is not a JPEG');
      return output;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  };
}

/** True if the program can be started (it may still exit with an error for the option). */
export async function heifAvailable(
  command = 'heif-convert',
  run: HeicRunner = defaultRun,
): Promise<boolean> {
  try {
    await run(command, ['--version'], { timeoutMs: 5000, cwd: os.tmpdir() });
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ENOENT';
  }
}
