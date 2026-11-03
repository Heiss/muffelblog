import { spawn } from 'node:child_process';
import { cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { readSettings } from '@muffelblog/core';
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
export function siteSteps(repoRoot: string): Step[] {
  const site = path.join(repoRoot, 'apps', 'site');
  const staging = path.join(site, '.release-staging');
  return [
    async () => {
      await rm(staging, { recursive: true, force: true });
      await run('pnpm', ['exec', 'astro', 'build', '--outDir', staging], site);
      await run('pnpm', ['exec', 'pagefind', '--site', staging], site);
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
  const id = await runRelease({
    root,
    steps: siteSteps(repoRoot),
    keep: settings.releasesKept,
  });
  console.log(`[builder] release ${id} is online in ${root}/current`);
}

main().catch((error: unknown) => {
  console.error('[builder] build failed, the last good version stays online');
  console.error(error);
  process.exit(1);
});
