import { describe, expect, it } from 'vitest';
import { builderDirs, writableDirs } from './wiring.ts';

describe('writableDirs', () => {
  it('names the data folders, never the checkout of the code', () => {
    const dirs = builderDirs({ REPO_DIR: '/repo' });
    expect(writableDirs(dirs)).toEqual({
      releasesDir: '/data/releases',
      cacheDir: '/data/cache',
      stateDir: '/data/state',
    });
  });
});
