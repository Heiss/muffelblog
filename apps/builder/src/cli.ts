import { spawn } from 'node:child_process';
import { cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { readSettings } from '@muffelblog/core';
import {
  assertNoFixtures,
  nextcloudConfig,
  syncNextcloud,
} from './nextcloud.ts';
import { createRcloneRemote } from './rclone.ts';
import { runRelease } from './release.ts';
import type { Step } from './release.ts';

/** Runs a command and fails with its exit code. Output goes to the container log. */
function run(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} ${args.join(' ')} exited with ${code}`)),
    );
  });
}

/**
 * Astro build and search index in a staging folder inside the container, then
 * a copy into the release folder. Astro moves files with `rename`, which fails
 * across file systems (EXDEV) when the release folder is on a Docker volume.
 */
export function siteSteps(
  repoRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): Step[] {
  const site = path.join(repoRoot, 'apps', 'site');
  const staging = path.join(site, '.release-staging');
  return [
    async () => {
      await rm(staging, { recursive: true, force: true });
      await run(
        'pnpm',
        ['exec', 'astro', 'build', '--outDir', staging],
        site,
        env,
      );
      await run('pnpm', ['exec', 'pagefind', '--site', staging], site, env);
    },
    async (dir) => {
      await cp(staging, dir, { recursive: true });
      await rm(staging, { recursive: true, force: true });
    },
  ];
}

async function main(): Promise<void> {
  // Invalid settings stop the build before anything is written.
  const settings = readSettings();
  const root = process.env.RELEASES_DIR || '/data/releases';
  const repoRoot = process.env.REPO_DIR || process.cwd();

  // With NEXTCLOUD_URL the articles come from the public share. The fetch
  // is checked and only then used; if it fails nothing is built.
  const env: NodeJS.ProcessEnv = { ...process.env };
  // The build needs the folder, not the secret.
  delete env.NEXTCLOUD_SHARE_PASSWORD;
  delete env.NEXTCLOUD_SHARE_PASSWORD_FILE;
  delete env.NEXTCLOUD_SHARE_TOKEN;
  assertNoFixtures();
  const nextcloud = nextcloudConfig();
  if (nextcloud) {
    const synced = await syncNextcloud({
      remote: createRcloneRemote(nextcloud),
      cacheDir: process.env.CACHE_DIR || '/data/cache',
      stateDir: process.env.STATE_DIR || '/data/state',
    });
    console.log(
      `[builder] Nextcloud: ${synced.files} files, ${synced.changed ? 'changed' : 'unchanged'}`,
    );
    env.CONTENT_DIR = synced.contentDir;
  }

  const id = await runRelease({
    root,
    steps: siteSteps(repoRoot, env),
    keep: settings.releasesKept,
  });
  console.log(`[builder] release ${id} is online in ${root}/current`);
}

main().catch((error: unknown) => {
  console.error('[builder] build failed, the last good version stays online');
  console.error(error);
  process.exit(1);
});
