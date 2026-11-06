import { spawn } from 'node:child_process';
import { cp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { readSettings } from '@muffelblog/core';
import { alertConfig } from './alert.ts';
import { assertWritable } from './dirs.ts';
import {
  assertNoFixtures,
  nextcloudConfig,
  syncNextcloud,
} from './nextcloud.ts';
import { createRcloneRemote } from './rclone.ts';
import { removeIncomplete, runRelease } from './release.ts';
import type { Step } from './release.ts';
import { createScheduler, type SearchStatus } from './scheduler.ts';
import { fileStore, sourcesFrom } from './serve.ts';
import { createWebmentionRunner } from './webmentions.ts';
import {
  alerter,
  buildEnv,
  builderDirs,
  writableDirs,
  noAvxHint,
  optionalSearch,
  pagefindCommand,
  searchReporter,
  polledSources,
  receiver,
  releaseOnline,
  requireSiteUrl,
  single,
  statusWriter,
} from './wiring.ts';

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

/** The search index of the built site; a failure names the image variant to use. */
async function searchIndex(
  site: string,
  staging: string,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  const variant = process.env.MUFFEL_IMAGE_VARIANT;
  const pagefind = pagefindCommand(site, variant);
  try {
    await run(
      pagefind.command,
      [...pagefind.args, '--site', staging],
      site,
      env,
    );
  } catch (error) {
    const cpuinfo = await readFile('/proc/cpuinfo', 'utf8').catch(() => '');
    const text = error instanceof Error ? error.message : String(error);
    throw new Error(`${text}${noAvxHint(cpuinfo, variant)}`, { cause: error });
  }
}

/**
 * Astro build and search index in a staging folder inside the container, then
 * a copy into the release folder. Astro moves files with `rename`, which fails
 * across file systems (EXDEV) when the release folder is on a Docker volume.
 */
export function siteSteps(
  repoRoot: string,
  env: NodeJS.ProcessEnv = process.env,
  noteSearch: (state: SearchStatus) => void = () => {},
): Step[] {
  const site = path.join(repoRoot, 'apps', 'site');
  const staging = path.join(site, '.release-staging');
  return [
    async () => {
      await rm(staging, { recursive: true, force: true });
      // The binaries directly: the image has no pnpm at run time.
      const bin = (name: string) =>
        path.join(site, 'node_modules', '.bin', name);
      await run(bin('astro'), ['build', '--outDir', staging], site, env);
      await optionalSearch(() => searchIndex(site, staging, env), noteSearch);
    },
    async (dir) => {
      await cp(staging, dir, { recursive: true });
      await rm(staging, { recursive: true, force: true });
    },
  ];
}

const log = (text: string): void => console.log(`[builder] ${text}`);

/** Waits for the next check; a stop signal (SIGTERM, SIGINT) ends the wait at once. */
function stopper() {
  let stopping = false;
  let wake: (() => void) | undefined;
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      stopping = true;
      wake?.();
    });
  }
  return {
    stopping: () => stopping,
    wait: (seconds: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, seconds * 1000);
        wake = () => {
          clearTimeout(timer);
          resolve();
        };
      }),
  };
}

/** The build of one release: Nextcloud into the cache, the site into a new release folder. */
function buildRelease(options: {
  dirs: ReturnType<typeof builderDirs>;
  remote?: ReturnType<typeof createRcloneRemote>;
  settings: { releasesKept: number };
  search: ReturnType<typeof searchReporter>;
}) {
  const { dirs, remote, search } = options;
  return async (): Promise<string> => {
    // The build gets the folder, not the secrets.
    const env = buildEnv();
    if (remote) {
      const synced = await syncNextcloud({
        remote,
        cacheDir: dirs.cacheDir,
        stateDir: dirs.stateDir,
      });
      log(
        `Nextcloud: ${synced.files} files, ${synced.changed ? 'changed' : 'unchanged'}`,
      );
      env.CONTENT_DIR = synced.contentDir;
    }
    const id = await runRelease({
      root: dirs.releasesDir,
      steps: siteSteps(dirs.repoRoot, env, search.note),
      keep: options.settings.releasesKept,
    });
    log(`release ${id} is online in ${dirs.releasesDir}/current`);
    await search.online();
    return id;
  };
}

/** The sender and the receiver of webmentions; each only when switched on. */
function webmentionTasks(options: {
  settings: ReturnType<typeof readSettings>;
  dirs: ReturnType<typeof builderDirs>;
  alert: ReturnType<typeof alerter>;
  onSummary: ReturnType<typeof statusWriter>['webmentions'];
}) {
  const { settings, dirs } = options;
  const siteUrl = process.env.SITE_URL?.trim() ?? '';
  const remarkUrl = process.env.REMARK_INTERNAL_URL?.trim();
  // Webmentions: off by default. When on, SITE_URL is needed (absolute source
  // addresses), and the builder stops at the start if it is missing.
  if (settings.webmentionsSend) requireSiteUrl(siteUrl);
  const sender = settings.webmentionsSend
    ? createWebmentionRunner({
        ...dirs,
        settings,
        siteUrl,
        alert: options.alert,
        log,
        onSummary: options.onSummary,
      })
    : undefined;
  const receive = receiver({
    settings,
    stateDir: dirs.stateDir,
    siteUrl,
    remarkUrl,
    log,
  });
  return {
    send: sender ? () => sender.run() : undefined,
    receive: receive
      ? single(() => receive.run(), log, 'webmentions received')
      : undefined,
  };
}

/** The folders of the builder, writable and without what a stopped build left. */
async function preparedDirs() {
  const dirs = builderDirs();
  // The builder runs as a normal user: say it plainly if a folder is not writable.
  await assertWritable(writableDirs(dirs));
  // What a stopped build left behind is not a release.
  await removeIncomplete(dirs.releasesDir);
  return dirs;
}

/** What is checked, built and run in the background, put together from the settings. */
async function setUp() {
  // Invalid settings stop the builder before anything is written.
  const settings = readSettings();
  const alert = alerter(alertConfig(), log);
  assertNoFixtures();
  const sources = sourcesFrom();
  const nextcloud = nextcloudConfig();
  const dirs = await preparedDirs();
  const remote = nextcloud ? createRcloneRemote(nextcloud) : undefined;
  const online = releaseOnline(dirs.releasesDir);
  const store = fileStore(dirs.stateDir);
  const status = statusWriter({
    writeStatus: store.writeStatus,
    releasesDir: dirs.releasesDir,
    checkIntervalSeconds: settings.checkIntervalSeconds,
    log,
  });
  const search = searchReporter({ alert, status: status.search });
  const tasks = webmentionTasks({
    settings,
    dirs,
    alert,
    onSummary: status.webmentions,
  });
  const scheduler = createScheduler({
    sources: polledSources({
      remote,
      real: sources.mode === 'real',
      settings,
      remarkUrl: process.env.REMARK_INTERNAL_URL?.trim(),
    }),
    debounceChecks: settings.debounceChecks,
    now: () => new Date(),
    loadState: store.loadState,
    saveState: store.saveState,
    writeStatus: status.write,
    hasRelease: online,
    alert,
    build: buildRelease({ dirs, remote, settings, search }),
  });
  log(
    `started (${sources.mode}, check every ${settings.checkIntervalSeconds}s, debounce ${settings.debounceChecks})`,
  );
  return {
    settings,
    online,
    scheduler,
    ...tasks,
  };
}

type Builder = Awaited<ReturnType<typeof setUp>>;

/** One check plus the background tasks after it. */
async function step(b: Builder, once: boolean): Promise<string> {
  let result: string;
  try {
    result = await b.scheduler.tick();
  } catch (error) {
    // Unexpected: keep running, the next check tries again.
    result = 'failed';
    console.error('[builder] unexpected error in the check', error);
  }
  if (result !== 'idle') log(`check: ${result}`);
  // In the background: slow foreign servers must not delay the next check.
  const background = [
    b.receive?.(),
    result === 'built' ? b.send?.() : undefined,
  ];
  if (once) await Promise.all(background);
  return result;
}

/**
 * Without a release online (first start, a service still coming up) a failed
 * check is tried again soon instead of after the full interval.
 */
async function pause(b: Builder, result: string): Promise<number> {
  const interval = b.settings.checkIntervalSeconds;
  const failed = result === 'failed' || result === 'poll-failed';
  return failed && !(await b.online()) ? Math.min(10, interval) : interval;
}

async function main(): Promise<void> {
  const once = process.argv.includes('--once');
  const b = await setUp();
  const stop = stopper();
  // A release may already be online (restart): take the first state of the
  // sender at once, so an entry written before the next build is not lost.
  if (b.send && (await b.online())) {
    const started = b.send();
    if (once) await started;
  }
  while (!stop.stopping()) {
    const result = await step(b, once);
    if (once) process.exit(result === 'built' || result === 'idle' ? 0 : 1);
    await stop.wait(await pause(b, result));
  }
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error('[builder] cannot start');
  console.error(error);
  process.exit(1);
});
