import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { SavedState, Status } from './scheduler.ts';
import { readFile } from 'node:fs/promises';

/** Writes a file so that a reader never sees half of it. */
async function writeAtomic(file: string, text: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, text);
  await rename(temp, file);
}

export function fileStore(stateDir: string) {
  const stateFile = path.join(stateDir, 'scheduler.json');
  const statusFile = path.join(stateDir, 'status.json');
  return {
    async loadState(): Promise<SavedState> {
      try {
        const parsed = JSON.parse(
          await readFile(stateFile, 'utf8'),
        ) as SavedState;
        return typeof parsed.builtMarker === 'string' ? parsed : {};
      } catch {
        return {};
      }
    },
    saveState: (state: SavedState) =>
      writeAtomic(stateFile, JSON.stringify(state) + '\n'),
    writeStatus: (status: Status) =>
      writeAtomic(statusFile, JSON.stringify(status, null, 2) + '\n'),
  };
}

export interface Sources {
  /** `demo`: sample content from the repo, nothing to poll. `real`: Nextcloud (or a folder) and Memos. */
  mode: 'demo' | 'real';
  nextcloud: boolean;
}

/**
 * Decides where the content comes from and stops at the start, not in the
 * middle of a build, if something is missing.
 */
export function sourcesFrom(
  env: Record<string, string | undefined> = process.env,
): Sources {
  const fixtures = env.MUFFEL_FIXTURES?.trim();
  const nextcloud = Boolean(env.NEXTCLOUD_URL?.trim());
  if (fixtures) return { mode: 'demo', nextcloud: false };
  if (!nextcloud && !env.CONTENT_DIR?.trim()) {
    throw new Error(
      'No content source: set NEXTCLOUD_URL (with token and password) or CONTENT_DIR, or MUFFEL_FIXTURES=demo for the sample content',
    );
  }
  if (!env.MEMOS_URL?.trim()) {
    throw new Error(
      'MEMOS_URL is required (or MUFFEL_FIXTURES=demo for the sample content)',
    );
  }
  return { mode: 'real', nextcloud };
}
