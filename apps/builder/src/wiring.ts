// The parts the builder is put together from (cli.ts). Small functions, each
// with one job, so they can be tested and stay below the complexity limits.
import { stat } from 'node:fs/promises';
import path from 'node:path';
import {
  commentsFingerprint,
  createHttpMemosSource,
  createRemarkSource,
  memosFingerprint,
  type Settings,
} from '@muffelblog/core';
import { sendAlert, type AlertConfig } from './alert.ts';
import { writeHealth } from './health.ts';
import { fingerprint } from './nextcloud.ts';
import { createAdminClient } from './remark-admin.ts';
import type {
  AlertEvent,
  Source,
  Status,
  WebmentionSummary,
} from './scheduler.ts';
import type { Remote } from './nextcloud.ts';
import { createReceiveRunner } from './webmentions-receive.ts';

type Env = Record<string, string | undefined>;
export type Log = (text: string) => void;

/** Folders of the builder, from the environment. */
export function builderDirs(env: Env = process.env) {
  return {
    releasesDir: env.RELEASES_DIR || '/data/releases',
    cacheDir: env.CACHE_DIR || '/data/cache',
    stateDir: env.STATE_DIR || '/data/state',
    repoRoot: env.REPO_DIR || process.cwd(),
  };
}

/** The folders the builder writes to; the checkout (`repoRoot`) is not one of them. */
export function writableDirs(dirs: ReturnType<typeof builderDirs>) {
  const { releasesDir, cacheDir, stateDir } = dirs;
  return { releasesDir, cacheDir, stateDir };
}

export const releaseOnline = (releasesDir: string) => (): Promise<boolean> =>
  stat(path.join(releasesDir, 'current', 'build.json')).then(
    () => true,
    () => false,
  );

/** The Nextcloud share as a source; an empty share is an error, never "everything deleted". */
export function nextcloudSource(remote: Remote): Source {
  return {
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
  };
}

/** The sources the scheduler checks: Nextcloud, Memos, and the comments of Remark42. */
export function polledSources(
  options: {
    remote?: Remote;
    real: boolean;
    settings: Settings;
    remarkUrl?: string;
  },
  env: Env = process.env,
): Source[] {
  const polled: Source[] = [];
  if (options.remote) polled.push(nextcloudSource(options.remote));
  if (options.real && env.MEMOS_URL) {
    const memos = createHttpMemosSource({
      baseUrl: env.MEMOS_URL,
      timeoutMs: options.settings.memosTimeoutMs,
    });
    polled.push({
      name: 'memos',
      poll: async () => memosFingerprint((await memos.listPublicMemos()).memos),
    });
  }
  // Comments: a change in Remark42 (new, edited, deleted) rebuilds the pages,
  // so the static copy stays current.
  if (options.remarkUrl) {
    const remark = createRemarkSource({
      baseUrl: options.remarkUrl,
      site: env.COMMENTS_SITE_ID?.trim() || 'muffelblog',
      timeoutMs: options.settings.memosTimeoutMs,
    });
    polled.push({
      name: 'comments',
      poll: async () => commentsFingerprint((await remark.last(1000)).comments),
    });
  }
  return polled;
}

/** The environment of the site build: without the secrets of the builder. */
export function buildEnv(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...env };
  for (const name of [
    'NEXTCLOUD_SHARE_PASSWORD',
    'NEXTCLOUD_SHARE_PASSWORD_FILE',
    'NEXTCLOUD_SHARE_TOKEN',
    'WEBMENTION_IO_TOKEN',
    'REMARK_ADMIN_PASSWD',
  ])
    delete out[name];
  return out;
}

/** Writes status.json (with the webmention totals) and the public health.json. */
export function statusWriter(options: {
  writeStatus: (status: Status) => Promise<void>;
  releasesDir: string;
  checkIntervalSeconds: number;
  log: Log;
}) {
  let webmentions: WebmentionSummary | undefined;
  let last: Status | undefined;
  const write = async (status: Status) => {
    last = status;
    await options.writeStatus(
      webmentions ? { ...status, webmentions } : status,
    );
    // The public copy goes into the release that is online. A problem with it
    // is logged and never stops a check.
    try {
      await writeHealth(
        options.releasesDir,
        status,
        options.checkIntervalSeconds,
        new Date(),
      );
    } catch (error) {
      options.log(
        `health.json not written: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
  return {
    write,
    async webmentions(summary: WebmentionSummary) {
      webmentions = summary;
      if (last) await write(last);
    },
  };
}

/** Logs an event and sends it to the webhook, if there is one. */
export function alerter(config: AlertConfig | undefined, log: Log) {
  return async (event: AlertEvent) => {
    log(`${event.kind}: ${event.message}`);
    if (config) await sendAlert(config, event);
  };
}

/** Sending needs an absolute address of the blog. */
export function requireSiteUrl(siteUrl: string): void {
  try {
    new URL(siteUrl);
  } catch {
    throw new Error(
      'MUFFEL_WEBMENTIONS_SEND=1 needs SITE_URL (the address of the blog, for example https://blog.example)',
    );
  }
}

/** Receiving stops the builder at the start when a value it needs is missing. */
function requireAll(values: Record<string, string | undefined>): void {
  const missing = Object.entries(values)
    .filter(([, v]) => !v)
    .map(([name]) => name);
  if (missing.length > 0)
    throw new Error(`MUFFEL_WEBMENTIONS_RECEIVE=1 needs ${missing.join(', ')}`);
}

/**
 * Receiving webmentions (W14): off by default. When on, the builder asks
 * webmention.io (or the stand-in of the demo) at every check and writes new
 * mentions into Remark42 as comments of the administrator.
 */
export function receiver(
  options: {
    settings: Settings;
    stateDir: string;
    siteUrl: string;
    remarkUrl?: string;
    log: Log;
  },
  env: Env = process.env,
) {
  if (!options.settings.webmentionsReceive) return undefined;
  const token = env.WEBMENTION_IO_TOKEN?.trim() ?? '';
  const password = env.REMARK_ADMIN_PASSWD ?? '';
  requireAll({
    SITE_URL: options.siteUrl,
    WEBMENTION_IO_TOKEN: token,
    REMARK_INTERNAL_URL: options.remarkUrl,
    REMARK_ADMIN_PASSWD: password,
  });
  return createReceiveRunner({
    stateDir: options.stateDir,
    siteUrl: options.siteUrl,
    apiUrl: env.WEBMENTION_IO_URL?.trim() || 'https://webmention.io',
    token,
    lang: options.settings.lang,
    admin: createAdminClient({
      baseUrl: options.remarkUrl as string,
      site: env.COMMENTS_SITE_ID?.trim() || 'muffelblog',
      password,
    }),
    log: options.log,
    timeoutMs: options.settings.webmentionsTimeoutMs,
    maxBytes: options.settings.webmentionsMaxBytes,
  });
}

/** Runs a task in the background, at most one at a time; a failure is logged. */
export function single(task: () => Promise<unknown>, log: Log, label: string) {
  let running: Promise<void> | undefined;
  return (): Promise<void> => {
    running ??= task()
      .then(() => undefined)
      .catch((error: unknown) => {
        log(
          `${label}: run failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      })
      .finally(() => {
        running = undefined;
      });
    return running;
  };
}
