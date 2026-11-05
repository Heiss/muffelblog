import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

// A called workflow gets no more rights than its caller grants. If a job of
// ci.yml asks for more than release.yml gives to the call, the release run
// fails at its start, on the tag (this happened once with CodeQL).

const root = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);
const workflow = async (name: string) =>
  parse(
    await readFile(path.join(root, '.github', 'workflows', name), 'utf8'),
  ) as {
    permissions?: Record<string, string>;
    jobs: Record<
      string,
      { uses?: string; permissions?: Record<string, string> }
    >;
  };

const LEVEL: Record<string, number> = { none: 0, read: 1, write: 2 };

describe('release workflow', () => {
  it('grants the CI call every right a job of the CI asks for', async () => {
    const ci = await workflow('ci.yml');
    const release = await workflow('release.yml');
    const call = Object.values(release.jobs).find(
      (job) => job.uses === './.github/workflows/ci.yml',
    );
    expect(call).toBeDefined();
    const granted = call?.permissions ?? release.permissions ?? {};
    const asked = [
      ci.permissions ?? {},
      ...Object.values(ci.jobs).map((job) => job.permissions ?? {}),
    ];
    for (const rights of asked) {
      for (const [scope, level] of Object.entries(rights)) {
        expect(
          LEVEL[granted[scope] ?? 'none'],
          `${scope}: ${level}`,
        ).toBeGreaterThanOrEqual(LEVEL[level] ?? 0);
      }
    }
  });
});
