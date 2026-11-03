import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  createFixtureMemosSource,
  createHttpMemosSource,
  readSettings,
} from '@muffelblog/core';
import type { MemosSource } from '@muffelblog/core';

export interface ContentConfig {
  /** Ordner mit den Markdown-Artikeln. */
  contentDir: string;
  /** Source of the public memos. */
  memos: MemosSource;
}

function findRepoRoot(start: string): string {
  let folder = path.resolve(start);
  for (;;) {
    if (existsSync(path.join(folder, 'pnpm-workspace.yaml'))) return folder;
    const parent = path.dirname(folder);
    if (parent === folder)
      throw new Error(
        'Repository root not found (pnpm-workspace.yaml is missing)',
      );
    folder = parent;
  }
}

/**
 * Chooses the content sources for the build.
 *
 * Intent: a build without explicit configuration must never publish sample
 * data. That is why `CONTENT_DIR` (synchronized Nextcloud folder) and
 * `MEMOS_URL` (address of the Memos instance) must be set. Sample data exists
 * only with `MUFFEL_FIXTURES=1` (development, tests).
 */
export function contentConfig(
  env: Record<string, string | undefined> = process.env,
): ContentConfig {
  if (env.MUFFEL_FIXTURES === '1') {
    const fixtures = path.join(
      findRepoRoot(process.cwd()),
      'packages',
      'core',
      'fixtures',
    );
    return {
      contentDir: path.join(fixtures, 'content'),
      memos: createFixtureMemosSource(path.join(fixtures, 'memos')),
    };
  }
  const missing = (['CONTENT_DIR', 'MEMOS_URL'] as const).filter(
    (name) => !env[name],
  );
  if (missing.length > 0) {
    throw new Error(
      `Content sources are not configured, missing: ${missing.join(', ')}. ` +
        'For development and tests with sample data set MUFFEL_FIXTURES=1.',
    );
  }
  return {
    contentDir: env.CONTENT_DIR as string,
    memos: createHttpMemosSource({
      baseUrl: env.MEMOS_URL as string,
      timeoutMs: readSettings(env).memosTimeoutMs,
    }),
  };
}
