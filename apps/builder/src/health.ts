import { readlink, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Status } from './scheduler.ts';

/** What is public at `/health.json`: no error text, no counters, nothing internal. */
export interface Health {
  state: 'ok' | 'failing';
  /** When this file was written. A monitor compares it with the clock. */
  generatedAt: string;
  lastCheck: string;
  lastSuccess?: { id: string; at: string };
  /** Only while failing: since when. */
  failingSince?: string;
  /** How often the builder checks, so a monitor can tell when the file is too old. */
  checkIntervalSeconds: number;
}

export function buildHealth(
  status: Status,
  checkIntervalSeconds: number,
  now: Date,
): Health {
  const health: Health = {
    state: status.state,
    generatedAt: now.toISOString(),
    lastCheck: status.lastCheck,
    checkIntervalSeconds,
  };
  if (status.lastSuccess) health.lastSuccess = status.lastSuccess;
  if (status.lastError) health.failingSince = status.lastError.since;
  return health;
}

/**
 * Writes `health.json` into the release that `current` points at, replacing it
 * atomically. It is called at every check, so `lastCheck` stays fresh while the
 * builder runs and stops moving when it does not. Without a release online
 * there is nothing to write into, and that is not an error.
 */
export async function writeHealth(
  releasesDir: string,
  status: Status,
  checkIntervalSeconds: number,
  now: Date,
): Promise<void> {
  let release: string;
  try {
    release = await readlink(path.join(releasesDir, 'current'));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'EINVAL' || code === 'ENOTDIR') return;
    throw error;
  }
  const dir = path.resolve(releasesDir, release);
  const file = path.join(dir, 'health.json');
  const temp = `${file}.${process.pid}.tmp`;
  const text = `${JSON.stringify(buildHealth(status, checkIntervalSeconds, now), null, 2)}\n`;
  try {
    await writeFile(temp, text);
    await rename(temp, file);
  } catch (error) {
    await rm(temp, { force: true });
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; // pruned meanwhile
    throw error;
  }
}
