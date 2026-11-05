import { spawn } from 'node:child_process';
import { cp, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  commentsFingerprint,
  createHttpMemosSource,
  createRemarkSource,
  memosFingerprint,
  readSettings,
} from '@muffelblog/core';
import { alertConfig, sendAlert } from './alert.ts';
import {
  assertNoFixtures,
  fingerprint,
  nextcloudConfig,
  syncNextcloud,
} from './nextcloud.ts';
import { createRcloneRemote } from './rclone.ts';
import { removeIncomplete, runRelease } from './release.ts';
import type { Step } from './release.ts';
import { createScheduler } from './scheduler.ts';
import type { AlertEvent, Source, Status } from './scheduler.ts';
import { fileStore, sourcesFrom } from './serve.ts';
import { assertWritable } from './dirs.ts';
import { writeHealth } from './health.ts';
import { createWebmentionRunner } from './webmentions.ts';
import type { WebmentionSummary } from './scheduler.ts';

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

const log = (text: string): void => console.log(`[builder] ${text}`);

async function main(): Promise<void> {
  const once = process.argv.includes('--once');
  // Invalid settings stop the builder before anything is written.
  const settings = readSettings();
  const alerts = alertConfig();
  assertNoFixtures();
  const sources = sourcesFrom();
  const nextcloud = nextcloudConfig();

  const releasesDir = process.env.RELEASES_DIR || '/data/releases';
  const cacheDir = process.env.CACHE_DIR || '/data/cache';
  const stateDir = process.env.STATE_DIR || '/data/state';
  const repoRoot = process.env.REPO_DIR || process.cwd();

  // The builder runs as a normal user: say it plainly if a folder is not writable.
  await assertWritable({ releasesDir, cacheDir, stateDir });

  // What a stopped build left behind is not a release.
  await removeIncomplete(releasesDir);

  const remote = nextcloud ? createRcloneRemote(nextcloud) : undefined;
  const memos =
    sources.mode === 'real' && process.env.MEMOS_URL
      ? createHttpMemosSource({
          baseUrl: process.env.MEMOS_URL,
          timeoutMs: settings.memosTimeoutMs,
        })
      : undefined;

  const polled: Source[] = [];
  if (remote) {
    polled.push({
      name: 'nextcloud',
      poll: async () => {
        const files = await remote.list();
        if (files.length === 0) {
          throw new Error(
            'The Nextcloud share is empty (refused, never treated as "everything deleted")',
          );
        }
        return fingerprint(files);
      },
    });
  }
  if (memos) {
    polled.push({
      name: 'memos',
      poll: async () => memosFingerprint((await memos.listPublicMemos()).memos),
    });
  }

  // Comments: a change in Remark42 (new, edited, deleted) rebuilds the pages,
  // so the static copy stays current.
  const remarkUrl = process.env.REMARK_INTERNAL_URL?.trim();
  if (remarkUrl) {
    const remark = createRemarkSource({
      baseUrl: remarkUrl,
      site: process.env.COMMENTS_SITE_ID?.trim() || 'muffelblog',
      timeoutMs: settings.memosTimeoutMs,
    });
    polled.push({
      name: 'comments',
      poll: async () => commentsFingerprint((await remark.last(1000)).comments),
    });
  }

  const releaseOnline = () =>
    stat(path.join(releasesDir, 'current', 'build.json')).then(
      () => true,
      () => false,
    );
  const store = fileStore(stateDir);

  // Webmentions: off by default. When on, SITE_URL is needed (absolute source
  // addresses), and the builder stops at the start if it is missing.
  let webmentionSummary: WebmentionSummary | undefined;
  let lastStatus: Status | undefined;
  const writeStatus = async (status: Status) => {
    lastStatus = status;
    await store.writeStatus(
      webmentionSummary
        ? { ...status, webmentions: webmentionSummary }
        : status,
    );
    // The public copy (/health.json) goes into the release that is online. A
    // problem with it is logged and never stops a check.
    try {
      await writeHealth(
        releasesDir,
        status,
        settings.checkIntervalSeconds,
        new Date(),
      );
    } catch (error) {
      log(
        `health.json not written: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
  const sendAlertEvent = async (event: AlertEvent) => {
    log(`${event.kind}: ${event.message}`);
    if (alerts) await sendAlert(alerts, event);
  };
  const siteUrl = process.env.SITE_URL?.trim() ?? '';
  if (settings.webmentionsSend) {
    try {
      new URL(siteUrl);
    } catch {
      throw new Error(
        'MUFFEL_WEBMENTIONS_SEND=1 needs SITE_URL (the address of the blog, for example https://blog.example)',
      );
    }
  }
  const webmentions = settings.webmentionsSend
    ? createWebmentionRunner({
        releasesDir,
        stateDir,
        settings,
        siteUrl,
        alert: sendAlertEvent,
        log: (line) => log(line),
        onSummary: async (summary) => {
          webmentionSummary = summary;
          if (lastStatus) await writeStatus(lastStatus);
        },
      })
    : undefined;

  const scheduler = createScheduler({
    sources: polled,
    debounceChecks: settings.debounceChecks,
    now: () => new Date(),
    loadState: store.loadState,
    saveState: store.saveState,
    writeStatus,
    hasRelease: releaseOnline,
    alert: sendAlertEvent,
    build: async () => {
      // The build gets the folder, not the secrets.
      const env: NodeJS.ProcessEnv = { ...process.env };
      delete env.NEXTCLOUD_SHARE_PASSWORD;
      delete env.NEXTCLOUD_SHARE_PASSWORD_FILE;
      delete env.NEXTCLOUD_SHARE_TOKEN;
      if (remote) {
        const synced = await syncNextcloud({ remote, cacheDir, stateDir });
        log(
          `Nextcloud: ${synced.files} files, ${synced.changed ? 'changed' : 'unchanged'}`,
        );
        env.CONTENT_DIR = synced.contentDir;
      }
      const id = await runRelease({
        root: releasesDir,
        steps: siteSteps(repoRoot, env),
        keep: settings.releasesKept,
      });
      log(`release ${id} is online in ${releasesDir}/current`);
      return id;
    },
  });

  let stopping = false;
  let wake: (() => void) | undefined;
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      stopping = true;
      wake?.();
    });
  }

  log(
    `started (${sources.mode}, check every ${settings.checkIntervalSeconds}s, debounce ${settings.debounceChecks})`,
  );
  let exitCode = 0;
  // A release may already be online (restart): take the first state of the
  // sender at once, so an entry written before the next build is not lost.
  if (webmentions && (await releaseOnline())) {
    const started = webmentions.run();
    if (once) await started;
  }
  while (!stopping) {
    let result: string;
    try {
      result = await scheduler.tick();
    } catch (error) {
      // Unexpected: keep running, the next check tries again.
      result = 'failed';
      console.error('[builder] unexpected error in the check', error);
    }
    if (result !== 'idle') log(`check: ${result}`);
    if (webmentions && result === 'built') {
      // In the background: slow foreign servers must not delay the next check.
      const started = webmentions.run();
      if (once) await started;
    }
    if (once) {
      exitCode = result === 'built' || result === 'idle' ? 0 : 1;
      break;
    }
    // Without a release online (first start, a service still coming up) a
    // failed check is tried again soon instead of after the full interval.
    const failed = result === 'failed' || result === 'poll-failed';
    const waitSeconds =
      failed && !(await releaseOnline())
        ? Math.min(10, settings.checkIntervalSeconds)
        : settings.checkIntervalSeconds;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, waitSeconds * 1000);
      wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }
  process.exit(exitCode);
}

main().catch((error: unknown) => {
  console.error('[builder] cannot start');
  console.error(error);
  process.exit(1);
});
