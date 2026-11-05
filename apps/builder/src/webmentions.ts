import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  emptyWebmentionState,
  extractEntry,
  runWebmentionSend,
  safeFetch,
  type SendDeps,
  type SendReport,
  type Settings,
  type SourceEntry,
  type WebmentionState,
} from '@muffelblog/core';
import type { AlertEvent, WebmentionSummary } from './scheduler.ts';
import { writeAtomic } from './serve.ts';

/** The kinds of pages that send: posts, memos and terms. */
const ENTRY_FOLDERS = ['p', 'm', 'g'] as const;

const ENOENT = (error: unknown) =>
  (error as NodeJS.ErrnoException).code === 'ENOENT';

/** The page folders of one kind in a release, sorted; none when the folder is missing. */
async function pageFolders(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch (error) {
    if (ENOENT(error)) return [];
    throw error;
  }
}

async function readPage(file: string): Promise<string | null> {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (ENOENT(error)) return null;
    throw error;
  }
}

/**
 * Reads the entries from a built release: exactly the pages that a receiver
 * will fetch. `siteUrl` is `SITE_URL`; its path (if any) is dropped.
 */
export async function scanRelease(
  releaseDir: string,
  siteUrl: string,
): Promise<SourceEntry[]> {
  const origin = new URL(siteUrl).origin;
  const entries: SourceEntry[] = [];
  for (const folder of ENTRY_FOLDERS) {
    for (const name of await pageFolders(path.join(releaseDir, folder))) {
      const html = await readPage(
        path.join(releaseDir, folder, name, 'index.html'),
      );
      if (html === null) continue;
      const source = `${origin}/${folder}/${name}/`;
      const entry = extractEntry(html, source);
      if (entry) entries.push({ source, hash: entry.hash, links: entry.links });
    }
  }
  return entries;
}

export function summarize(state: WebmentionState, at: Date): WebmentionSummary {
  const count = (status: string) =>
    Object.values(state.pairs).filter((p) => p.status === status).length;
  return {
    lastRun: at.toISOString(),
    sent: count('sent'),
    failed: count('failed'),
    givenUp: count('given-up'),
    noEndpoint: count('no-endpoint'),
  };
}

export interface RunnerOptions {
  releasesDir: string;
  stateDir: string;
  settings: Settings;
  siteUrl: string;
  alert: (event: AlertEvent) => Promise<void>;
  /** Called with the totals after every run. */
  onSummary: (summary: WebmentionSummary) => void | Promise<void>;
  log: (line: string) => void;
  /** Injectable for tests. */
  deps?: Partial<Pick<SendDeps, 'fetch' | 'sleep' | 'now'>>;
}

/** Loads the state. A missing or damaged file counts as a first start (nothing is sent in that run). */
export async function loadState(
  file: string,
  log: (l: string) => void,
): Promise<WebmentionState> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return emptyWebmentionState();
    throw error;
  }
  try {
    const parsed = JSON.parse(text) as WebmentionState;
    if (
      parsed?.version === 1 &&
      typeof parsed.entries === 'object' &&
      typeof parsed.pairs === 'object'
    )
      return parsed;
  } catch {
    // falls through
  }
  log(
    `${file} is damaged, it is treated as a first start: the existing entries count as already sent`,
  );
  return emptyWebmentionState();
}

function sendDeps(options: RunnerOptions, stateFile: string): SendDeps {
  const { settings } = options;
  const netFetch: SendDeps['fetch'] = (url, init) =>
    safeFetch(url, init, {
      timeoutMs: settings.webmentionsTimeoutMs,
      maxBytes: settings.webmentionsMaxBytes,
      maxRedirects: 3,
      allowPrivate: settings.webmentionsAllowPrivate,
    });
  return {
    fetch: options.deps?.fetch ?? netFetch,
    sleep:
      options.deps?.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
    now: options.deps?.now ?? (() => new Date()),
    log: (line) => options.log(line),
    settings,
    siteUrl: options.siteUrl,
    save: (state) =>
      writeAtomic(stateFile, JSON.stringify(state, null, 2) + '\n'),
  };
}

/** One log line about the run: the first start, or what went out. */
function logRun(
  options: RunnerOptions,
  report: SendReport,
  firstStart: boolean,
): void {
  if (firstStart) {
    options.log(
      `webmentions: first start, ${report.baselined} existing entries are stored as already sent (nothing is sent)`,
    );
    return;
  }
  const total =
    report.sent + report.failed + report.givenUp.length + report.noEndpoint;
  if (total === 0) return;
  options.log(
    `webmentions: ${report.sent} sent, ${report.failed} failed (will be tried again), ${report.givenUp.length} given up, ${report.noEndpoint} without endpoint`,
  );
}

/** Pairs that were given up go to the alert webhook, at most ten lines. */
async function alertGivenUp(
  options: RunnerOptions,
  report: SendReport,
  at: Date,
): Promise<void> {
  if (report.givenUp.length === 0) return;
  const lines = report.givenUp
    .slice(0, 10)
    .map((g) => `${g.source} -> ${g.target}: ${g.error}`);
  await options.alert({
    kind: 'webmention',
    message: `${report.givenUp.length} webmention(s) given up:\n${lines.join('\n')}`,
    at: at.toISOString(),
  });
}

/** One run of the sender over the release that is online. */
async function runOnce(
  options: RunnerOptions,
  stateFile: string,
  sendExisting: boolean,
): Promise<void> {
  const deps = sendDeps(options, stateFile);
  const state = await loadState(stateFile, options.log);
  const entries = await scanRelease(
    path.join(options.releasesDir, 'current'),
    options.siteUrl,
  );
  const firstStart = !state.initialized && !sendExisting;
  const { state: next, report } = await runWebmentionSend(
    state,
    entries,
    deps,
    {
      sendExisting,
    },
  );
  logRun(options, report, firstStart);
  await writeAtomic(stateFile, JSON.stringify(next, null, 2) + '\n');
  await options.onSummary(summarize(next, deps.now()));
  await alertGivenUp(options, report, deps.now());
}

/**
 * Runs the sender after a build, one run at a time, in the background of the
 * builder. A failure is logged and never stops the builder or a build.
 */
export function createWebmentionRunner(options: RunnerOptions) {
  const stateFile = path.join(options.stateDir, 'webmentions.json');
  let running: Promise<void> | undefined;
  let again = false;
  let sendExisting = false;

  async function once(): Promise<void> {
    const onPurpose = sendExisting;
    sendExisting = false;
    await runOnce(options, stateFile, onPurpose);
  }

  async function loop(): Promise<void> {
    do {
      again = false;
      try {
        await once();
      } catch (error) {
        options.log(
          `webmentions: run failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } while (again);
  }

  return {
    /** Starts a run in the background; a run that is already going on is repeated once afterwards. */
    run(opts: { sendExisting?: boolean } = {}): Promise<void> {
      if (opts.sendExisting) sendExisting = true;
      if (running) {
        again = true;
        return running;
      }
      running = loop().finally(() => {
        running = undefined;
      });
      return running;
    },
  };
}
