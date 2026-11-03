import {
  mkdir,
  readdir,
  readlink,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

/** A step of a build: fills the (new, empty) release folder. */
export type Step = (releaseDir: string) => Promise<void>;

/** Sortable, safe as a folder name: `20261103T180509Z`. */
export function releaseId(now: Date): string {
  return now
    .toISOString()
    .replace(/\.\d+Z$/, 'Z')
    .replace(/[-:]/g, '');
}

function assertPlainName(name: string): void {
  if (name === '' || name === '.' || name === '..' || /[\\/]/.test(name)) {
    throw new Error(`Not a release name: "${name}"`);
  }
}

/**
 * Points `current` at a release, atomically: a new link is created next to
 * it and renamed over the old one, so the web server never sees a gap. The
 * link is relative, so it works under any mount path.
 */
export async function swapCurrent(root: string, id: string): Promise<void> {
  assertPlainName(id);
  const target = path.join(root, id);
  if (!(await stat(target).catch(() => null))?.isDirectory()) {
    throw new Error(`Release "${id}" does not exist in ${root}`);
  }
  const temp = path.join(root, `.current-${process.pid}-${Date.now()}`);
  await symlink(id, temp);
  try {
    await rename(temp, path.join(root, 'current'));
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

/**
 * Deletes old releases: the newest `keep` (by name) and the one `current`
 * points to stay. Only folders are touched, never files or the link.
 */
export async function pruneReleases(root: string, keep: number): Promise<void> {
  const entries = await readdir(root, { withFileTypes: true });
  const ids = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
  const current = await readlink(path.join(root, 'current')).catch(() => null);
  const keepSet = new Set(ids.slice(Math.max(0, ids.length - keep)));
  if (current) keepSet.add(current);
  for (const id of ids) {
    if (!keepSet.has(id)) await rm(path.join(root, id), { recursive: true });
  }
}

/** The build signal. It is written as the last file of a release. */
export async function writeBuildJson(
  releaseDir: string,
  id: string,
  now: Date,
): Promise<void> {
  const body = { id, builtAt: now.toISOString() };
  await writeFile(
    path.join(releaseDir, 'build.json'),
    JSON.stringify(body) + '\n',
  );
}

export interface RunOptions {
  /** Folder with the releases and the link `current`. */
  root: string;
  steps: readonly Step[];
  /** Number of releases kept after the swap. */
  keep: number;
  now?: Date;
}

/**
 * Builds a release in a new folder, writes `build.json` last and only then
 * swaps `current`. If any step fails, the half-built folder is removed and the
 * last good version stays online.
 */
export async function runRelease(options: RunOptions): Promise<string> {
  const now = options.now ?? new Date();
  const id = releaseId(now);
  const dir = path.join(options.root, id);
  await mkdir(options.root, { recursive: true });
  try {
    await mkdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(`Release "${id}" already exists, nothing was changed`, {
        cause: error,
      });
    }
    throw error;
  }
  try {
    for (const step of options.steps) await step(dir);
    await writeBuildJson(dir, id, now);
    await swapCurrent(options.root, id);
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
  await pruneReleases(options.root, options.keep);
  return id;
}
