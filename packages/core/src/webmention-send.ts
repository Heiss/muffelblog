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

/** The links of an entry that count as targets (own host, blocked hosts, credentials excluded). */
function targetsOf(entry: SourceEntry, deps: SendDeps): string[] {
  const own = hostOf(deps.siteUrl);
  const out: string[] = [];
  for (const link of entry.links) {
    let url: URL;
    try {
      url = new URL(link);
    } catch {
      continue;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
    if (url.username !== '' || url.password !== '') continue;
    const host = url.hostname.toLowerCase();
    if (url.host.toLowerCase() === own) continue;
    const blocked = deps.settings.webmentionsBlock.some(
      (b) => host === b || host.endsWith(`.${b}`),
    );
    if (blocked) continue;
    if (!out.includes(link)) out.push(link);
    if (out.length >= deps.settings.webmentionsMaxTargets) break;
  }
  return out;
}

interface Job {
  source: string;
  target: string;
  reason: PairState['reason'];
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
  const state: WebmentionState = structuredClone(previous);
  const report: SendReport = {
    baselined: 0,
    sent: 0,
    failed: 0,
    noEndpoint: 0,
    givenUp: [],
  };
  const jobs = new Map<string, Job>();
  const add = (job: Job) => jobs.set(pairKey(job.source, job.target), job);

  const current = new Map(entries.map((e) => [e.source, e]));
  const first = !state.initialized;

  for (const entry of entries) {
    const targets = targetsOf(entry, deps);
    const known = state.entries[entry.source];
    if (first) {
      if (options.sendExisting) {
        for (const target of targets)
          add({ source: entry.source, target, reason: 'existing' });
      } else report.baselined += 1;
    } else if (!known) {
      for (const target of targets)
        add({ source: entry.source, target, reason: 'new' });
    } else if (known.hash !== entry.hash) {
      for (const target of targets)
        add({ source: entry.source, target, reason: 'changed' });
      for (const target of known.targets)
        if (!targets.includes(target))
          add({ source: entry.source, target, reason: 'removed' });
    }
    state.entries[entry.source] = { hash: entry.hash, targets };
  }
  for (const [source, known] of Object.entries(state.entries)) {
    if (current.has(source)) continue;
    for (const target of known.targets)
      add({ source, target, reason: 'removed' });
    delete state.entries[source];
  }
  state.initialized = true;

  // A failed pair gets another try, unless a new notification replaces it.
  for (const pair of Object.values(state.pairs)) {
    if (pair.status !== 'failed') continue;
    const key = pairKey(pair.source, pair.target);
    if (!jobs.has(key))
      jobs.set(key, {
        source: pair.source,
        target: pair.target,
        reason: pair.reason,
      });
  }

  let requests = 0;
  const request = async (
    url: string,
    init: SafeFetchInit,
  ): Promise<SafeResponse> => {
    if (requests > 0 && deps.settings.webmentionsDelayMs > 0)
      await deps.sleep(deps.settings.webmentionsDelayMs);
    requests += 1;
    return deps.fetch(url, init);
  };

  const endpointFor = async (target: string): Promise<string | null> => {
    const host = hostOf(target) as string;
    const now = deps.now().getTime();
    const known = state.hosts[host];
    if (known) {
      const days =
        known.endpoint === null
          ? deps.settings.webmentionsNoEndpointDays
          : deps.settings.webmentionsEndpointDays;
      if (now - Date.parse(known.checkedAt) < days * DAY) return known.endpoint;
    }
    const response = await request(target, {});
    if (response.status >= 500)
      throw new Error(`HTTP ${response.status} while looking for the endpoint`);
    const endpoint = findEndpoint(response);
    // A missing page (404) says nothing about the host, so it is not remembered.
    if (endpoint === null && response.status >= 400) return null;
    state.hosts[host] = { endpoint, checkedAt: deps.now().toISOString() };
    return endpoint;
  };

  for (const job of jobs.values()) {
    const key = pairKey(job.source, job.target);
    const old = state.pairs[key];
    // A new notification starts counting again; a retry continues.
    const retry = old?.status === 'failed' && old.reason === job.reason;
    const attempts = (retry ? old.attempts : 0) + 1;
    const stamp = deps.now().toISOString();
    try {
      const endpoint = await endpointFor(job.target);
      if (endpoint === null) {
        state.pairs[key] = {
          ...job,
          status: 'no-endpoint',
          attempts: 0,
          lastAttemptAt: stamp,
        };
        report.noEndpoint += 1;
      } else {
        const body = new URLSearchParams({
          source: job.source,
          target: job.target,
        }).toString();
        const response = await request(endpoint, {
          method: 'POST',
          body,
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
        });
        if (response.status >= 200 && response.status < 300) {
          state.pairs[key] = {
            ...job,
            status: 'sent',
            attempts,
            lastAttemptAt: stamp,
            sentAt: stamp,
          };
          report.sent += 1;
          deps.log(
            `webmention sent (${job.reason}): ${job.source} -> ${job.target} (HTTP ${response.status})`,
          );
        } else throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const giveUp = attempts >= deps.settings.webmentionsAttempts;
      state.pairs[key] = {
        ...job,
        status: giveUp ? 'given-up' : 'failed',
        attempts,
        lastAttemptAt: stamp,
        error: message,
      };
      if (giveUp) {
        report.givenUp.push({
          source: job.source,
          target: job.target,
          error: message,
        });
      } else report.failed += 1;
      deps.log(
        `webmention ${giveUp ? 'given up' : 'failed'} (try ${attempts} of ${deps.settings.webmentionsAttempts}): ${job.source} -> ${job.target}: ${message}`,
      );
    }
    await deps.save?.(state);
  }
  await deps.save?.(state);
  return { state, report };
}
