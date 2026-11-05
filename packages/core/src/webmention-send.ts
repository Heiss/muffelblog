import type { Settings } from './config.ts';
import { findEndpoint } from './webmention-extract.ts';
import type { SafeFetchInit, SafeResponse } from './webmention-net.ts';

/** An entry of the site as the sender sees it: its address, content hash and links. */
export interface SourceEntry {
  /** Absolute address of the entry on the own site. */
  source: string;
  hash: string;
  /** Absolute http(s) links in the content. */
  links: string[];
}

export interface PairState {
  source: string;
  target: string;
  status: 'sent' | 'failed' | 'given-up' | 'no-endpoint';
  /** Why it was sent: a new entry, a changed one, a removed entry or link. */
  reason: 'new' | 'changed' | 'removed' | 'existing';
  attempts: number;
  lastAttemptAt: string;
  sentAt?: string;
  error?: string;
}

export interface WebmentionState {
  version: 1;
  /** Origin of `SITE_URL` the entries were stored under. A change resets the state quietly. */
  origin?: string;
  /** False until the first run has stored the existing entries as already sent. */
  initialized: boolean;
  /** What is known about the hosts of the targets. */
  hosts: Record<string, { endpoint: string | null; checkedAt: string }>;
  /** The last state of every entry that was reported (or stored at the first run). */
  entries: Record<string, { hash: string; targets: string[] }>;
  pairs: Record<string, PairState>;
}

export function emptyWebmentionState(): WebmentionState {
  return { version: 1, initialized: false, hosts: {}, entries: {}, pairs: {} };
}

export interface SendReport {
  baselined: number;
  sent: number;
  failed: number;
  noEndpoint: number;
  /** Pairs that were given up in this run. */
  givenUp: { source: string; target: string; error: string }[];
}

export interface SendDeps {
  fetch: (url: string, init: SafeFetchInit) => Promise<SafeResponse>;
  sleep: (ms: number) => Promise<void>;
  now: () => Date;
  log: (line: string) => void;
  settings: Settings;
  /** `SITE_URL`: without it there is no absolute source address. */
  siteUrl: string;
  /** Called with the state after every request, so a restart loses nothing. */
  save?: (state: WebmentionState) => Promise<void>;
}

const DAY = 86_400_000;

const pairKey = (source: string, target: string) => `${source} ${target}`;

function hostOf(address: string): string | null {
  try {
    return new URL(address).host.toLowerCase();
  } catch {
    return null;
  }
}

/** The link as a target, or null (not http(s), credentials, own host, blocked host). */
function asTarget(
  link: string,
  own: string | null,
  block: string[],
): string | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username !== '' || url.password !== '') return null;
  if (url.host.toLowerCase() === own) return null;
  const host = url.hostname.toLowerCase();
  const blocked = block.some((b) => host === b || host.endsWith(`.${b}`));
  return blocked ? null : link;
}

/** The links of an entry that count as targets (own host, blocked hosts, credentials excluded). */
function targetsOf(entry: SourceEntry, deps: SendDeps): string[] {
  const own = hostOf(deps.siteUrl);
  const out: string[] = [];
  for (const link of entry.links) {
    const target = asTarget(link, own, deps.settings.webmentionsBlock);
    if (target !== null && !out.includes(target)) out.push(target);
    if (out.length >= deps.settings.webmentionsMaxTargets) break;
  }
  return out;
}

interface Job {
  source: string;
  target: string;
  reason: PairState['reason'];
}

/** What one run works with: the state it changes, the report, the requests made. */
interface Run {
  state: WebmentionState;
  deps: SendDeps;
  report: SendReport;
  requests: number;
}

/** A copy of the state for this run; a changed site address starts over without sending. */
function startState(
  previous: WebmentionState,
  deps: SendDeps,
): WebmentionState {
  const state: WebmentionState = structuredClone(previous);
  const origin = new URL(deps.siteUrl).origin;
  if (state.origin !== undefined && state.origin !== origin) {
    // The domain changed: every entry has a new address, so all of them would
    // look new and every link would be reported again. Treat it like a first
    // start instead: store the entries, send nothing, forget the old pairs.
    deps.log(
      `webmentions: the site address changed from ${state.origin} to ${origin}, the entries are stored under the new address without sending`,
    );
    state.initialized = false;
    state.entries = {};
    state.pairs = {};
  }
  state.origin = origin;
  return state;
}

/** The notifications for one entry, compared with what was known about it. */
function jobsForEntry(
  entry: SourceEntry,
  targets: string[],
  known: { hash: string; targets: string[] } | undefined,
  first: { yes: boolean; sendExisting: boolean },
): Job[] {
  const each = (list: string[], reason: Job['reason']) =>
    list.map((target) => ({ source: entry.source, target, reason }));
  if (first.yes) return first.sendExisting ? each(targets, 'existing') : [];
  if (!known) return each(targets, 'new');
  if (known.hash === entry.hash) return [];
  return [
    ...each(targets, 'changed'),
    ...each(
      known.targets.filter((t) => !targets.includes(t)),
      'removed',
    ),
  ];
}

/** Notices for the targets of entries that are gone; the entries are forgotten. */
function goneEntryJobs(state: WebmentionState, current: Set<string>): Job[] {
  const jobs: Job[] = [];
  for (const [source, known] of Object.entries(state.entries)) {
    if (current.has(source)) continue;
    for (const target of known.targets)
      jobs.push({ source, target, reason: 'removed' });
    delete state.entries[source];
  }
  return jobs;
}

/** A failed pair gets another try, unless a new notification replaces it. */
function retryJobs(state: WebmentionState): Job[] {
  return Object.values(state.pairs)
    .filter((pair) => pair.status === 'failed')
    .map((pair) => ({
      source: pair.source,
      target: pair.target,
      reason: pair.reason,
    }));
}

/** All notifications of this run: new, changed and gone entries, and retries. */
function planJobs(
  run: Run,
  entries: readonly SourceEntry[],
  sendExisting: boolean,
): Map<string, Job> {
  const { state } = run;
  const jobs = new Map<string, Job>();
  const add = (job: Job) => jobs.set(pairKey(job.source, job.target), job);
  const first = { yes: !state.initialized, sendExisting };
  for (const entry of entries) {
    const targets = targetsOf(entry, run.deps);
    if (first.yes && !sendExisting) run.report.baselined += 1;
    jobsForEntry(entry, targets, state.entries[entry.source], first).forEach(
      add,
    );
    state.entries[entry.source] = { hash: entry.hash, targets };
  }
  goneEntryJobs(state, new Set(entries.map((e) => e.source))).forEach(add);
  state.initialized = true;
  for (const job of retryJobs(state))
    if (!jobs.has(pairKey(job.source, job.target))) add(job);
  return jobs;
}

/** A request to a foreign server, with the pause between two requests. */
async function request(
  run: Run,
  url: string,
  init: SafeFetchInit,
): Promise<SafeResponse> {
  const delay = run.deps.settings.webmentionsDelayMs;
  if (run.requests > 0 && delay > 0) await run.deps.sleep(delay);
  run.requests += 1;
  return run.deps.fetch(url, init);
}

/** The webmention endpoint of the host of `target`, remembered per host for a while. */
async function endpointFor(run: Run, target: string): Promise<string | null> {
  const { state, deps } = run;
  const host = hostOf(target) as string;
  const known = state.hosts[host];
  if (known) {
    const days =
      known.endpoint === null
        ? deps.settings.webmentionsNoEndpointDays
        : deps.settings.webmentionsEndpointDays;
    if (deps.now().getTime() - Date.parse(known.checkedAt) < days * DAY)
      return known.endpoint;
  }
  const response = await request(run, target, {});
  if (response.status >= 500)
    throw new Error(`HTTP ${response.status} while looking for the endpoint`);
  const endpoint = findEndpoint(response);
  // A missing page (404) says nothing about the host, so it is not remembered.
  if (endpoint === null && response.status >= 400) return null;
  state.hosts[host] = { endpoint, checkedAt: deps.now().toISOString() };
  return endpoint;
}

/** Posts the notification to the endpoint; anything but 2xx is an error. */
async function notify(run: Run, endpoint: string, job: Job): Promise<number> {
  const body = new URLSearchParams({
    source: job.source,
    target: job.target,
  }).toString();
  const response = await request(run, endpoint, {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
  if (response.status < 200 || response.status >= 300)
    throw new Error(`HTTP ${response.status}`);
  return response.status;
}

function recordFailure(
  run: Run,
  job: Job,
  attempts: number,
  error: unknown,
): void {
  const { deps, report } = run;
  const message = error instanceof Error ? error.message : String(error);
  const giveUp = attempts >= deps.settings.webmentionsAttempts;
  run.state.pairs[pairKey(job.source, job.target)] = {
    ...job,
    status: giveUp ? 'given-up' : 'failed',
    attempts,
    lastAttemptAt: deps.now().toISOString(),
    error: message,
  };
  if (giveUp)
    report.givenUp.push({
      source: job.source,
      target: job.target,
      error: message,
    });
  else report.failed += 1;
  deps.log(
    `webmention ${giveUp ? 'given up' : 'failed'} (try ${attempts} of ${deps.settings.webmentionsAttempts}): ${job.source} -> ${job.target}: ${message}`,
  );
}

/** Sends one notification and records the outcome in the state and the report. */
async function sendJob(run: Run, job: Job): Promise<void> {
  const { state, deps, report } = run;
  const key = pairKey(job.source, job.target);
  const old = state.pairs[key];
  // A new notification starts counting again; a retry continues.
  const retry = old?.status === 'failed' && old.reason === job.reason;
  const attempts = (retry ? old.attempts : 0) + 1;
  const stamp = deps.now().toISOString();
  try {
    const endpoint = await endpointFor(run, job.target);
    if (endpoint === null) {
      state.pairs[key] = {
        ...job,
        status: 'no-endpoint',
        attempts: 0,
        lastAttemptAt: stamp,
      };
      report.noEndpoint += 1;
      return;
    }
    const status = await notify(run, endpoint, job);
    state.pairs[key] = {
      ...job,
      status: 'sent',
      attempts,
      lastAttemptAt: stamp,
      sentAt: stamp,
    };
    report.sent += 1;
    deps.log(
      `webmention sent (${job.reason}): ${job.source} -> ${job.target} (HTTP ${status})`,
    );
  } catch (error) {
    recordFailure(run, job, attempts, error);
  }
}

/**
 * Works out what has to be sent and sends it. Pure with respect to its input:
 * the given state is not changed, a new one is returned.
 *
 * - First run (state not initialized): the entries are stored as already sent,
 *   nothing goes out (unless `sendExisting`).
 * - New entry: every target. Changed entry: every target, and a notice for a
 *   target that is no longer linked. Entry that is gone: a notice for each of
 *   its targets. The receiver fetches the source and sees what is left.
 * - A failed pair is tried again in later runs until the attempts are used up.
 */
export async function runWebmentionSend(
  previous: WebmentionState,
  entries: readonly SourceEntry[],
  deps: SendDeps,
  options: { sendExisting?: boolean } = {},
): Promise<{ state: WebmentionState; report: SendReport }> {
  if (deps.siteUrl.trim() === '') {
    throw new Error(
      'Sending webmentions needs SITE_URL: without it there is no absolute address for the source.',
    );
  }
  const run: Run = {
    state: startState(previous, deps),
    deps,
    report: { baselined: 0, sent: 0, failed: 0, noEndpoint: 0, givenUp: [] },
    requests: 0,
  };
  const jobs = planJobs(run, entries, options.sendExisting === true);
  for (const job of jobs.values()) {
    await sendJob(run, job);
    await deps.save?.(run.state);
  }
  await deps.save?.(run.state);
  return { state: run.state, report: run.report };
}
