export interface Source {
  name: string;
  /**
   * A marker of the current content of the source (a fingerprint). Throws if
   * the source cannot be read completely; that is never treated as a change.
   */
  poll(): Promise<string>;
}

/** What the webmention sender has done so far (totals of the state file). */
export interface WebmentionSummary {
  lastRun: string;
  sent: number;
  failed: number;
  givenUp: number;
  noEndpoint: number;
}

/** The search index of the release that is online; it never stops a release. */
export type SearchStatus =
  { state: 'ok' } | { state: 'failed'; message: string };

export interface Status {
  state: 'ok' | 'failing';
  /** Only present when sending webmentions is switched on. */
  webmentions?: WebmentionSummary;
  /** Present after the first release of this run. */
  search?: SearchStatus;
  lastCheck: string;
  lastSuccess?: { id: string; at: string };
  lastError?: { message: string; at: string; since: string };
}

export interface AlertEvent {
  kind: 'failed' | 'recovered' | 'webmention' | 'search';
  message: string;
  at: string;
}

export interface SavedState {
  /** Marker of the content that the online release was built from. */
  builtMarker?: string;
}

export interface SchedulerDeps {
  sources: readonly Source[];
  /** Fetches what the sources need and builds a release. Returns its id. */
  build(): Promise<string>;
  loadState(): Promise<SavedState>;
  saveState(state: SavedState): Promise<void>;
  writeStatus(status: Status): Promise<void>;
  alert(event: AlertEvent): Promise<void>;
  /** Is there a release online? Without one the next run builds at once. */
  hasRelease(): Promise<boolean>;
  /** Equal checks in a row needed after a change (0 = build at once). */
  debounceChecks: number;
  now(): Date;
}

export type TickResult =
  'idle' | 'waiting' | 'built' | 'failed' | 'poll-failed';

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** What the scheduler remembers between two checks. */
interface SchedulerState {
  loaded: boolean;
  builtMarker?: string;
  pending?: { marker: string; seen: number };
  lastSuccess: Status['lastSuccess'];
  failingSince?: string;
  lastError: Status['lastError'];
}

async function fail(
  s: SchedulerState,
  deps: SchedulerDeps,
  error: unknown,
  at: string,
): Promise<void> {
  const text = message(error);
  const first = s.failingSince === undefined;
  s.failingSince ??= at;
  s.lastError = { message: text, at, since: s.failingSince };
  await deps.writeStatus({
    state: 'failing',
    lastCheck: at,
    lastSuccess: s.lastSuccess,
    lastError: s.lastError,
  });
  if (first) await deps.alert({ kind: 'failed', message: text, at });
}

async function ok(
  s: SchedulerState,
  deps: SchedulerDeps,
  at: string,
): Promise<void> {
  if (s.failingSince !== undefined) {
    s.failingSince = undefined;
    s.lastError = undefined;
    await deps.alert({
      kind: 'recovered',
      message: 'The sources and the build work again',
      at,
    });
  }
  await deps.writeStatus({
    state: 'ok',
    lastCheck: at,
    lastSuccess: s.lastSuccess,
  });
}

/** One line per source: what the content looks like now. */
async function currentMarker(deps: SchedulerDeps): Promise<string> {
  const markers = await Promise.all(
    deps.sources.map(async (src) => `${src.name}=${await src.poll()}`),
  );
  return markers.join('\n');
}

/**
 * True while a change has not stayed the same for the configured number of
 * checks. Nothing online yet: never wait, build at once.
 */
function stillWaiting(
  s: SchedulerState,
  deps: SchedulerDeps,
  marker: string,
  online: boolean,
): boolean {
  if (!online) return false;
  if (s.pending?.marker === marker) s.pending.seen += 1;
  else s.pending = { marker, seen: 0 };
  return s.pending.seen < deps.debounceChecks;
}

async function build(
  s: SchedulerState,
  deps: SchedulerDeps,
  marker: string,
  at: string,
): Promise<TickResult> {
  try {
    const id = await deps.build();
    s.builtMarker = marker;
    s.pending = undefined;
    s.lastSuccess = { id, at };
    await deps.saveState({ builtMarker: marker });
  } catch (error) {
    await fail(s, deps, error, at);
    return 'failed';
  }
  await ok(s, deps, at);
  return 'built';
}

async function tick(
  s: SchedulerState,
  deps: SchedulerDeps,
): Promise<TickResult> {
  const at = deps.now().toISOString();
  if (!s.loaded) {
    s.builtMarker = (await deps.loadState()).builtMarker;
    s.loaded = true;
  }
  let marker: string;
  try {
    marker = await currentMarker(deps);
  } catch (error) {
    await fail(s, deps, error, at);
    return 'poll-failed';
  }
  const online = await deps.hasRelease();
  if (online && marker === s.builtMarker) {
    s.pending = undefined;
    await ok(s, deps, at);
    return 'idle';
  }
  if (stillWaiting(s, deps, marker, online)) {
    await ok(s, deps, at);
    return 'waiting';
  }
  return build(s, deps, marker, at);
}

/**
 * One check of all sources per `tick()`. A change is built only after it stayed
 * the same for `debounceChecks` further checks, so half-synchronized files are
 * not published. A source that cannot be read or a failed build keeps the last
 * good release online; a failure is reported once and its end once.
 */
export function createScheduler(deps: SchedulerDeps) {
  const state: SchedulerState = {
    loaded: false,
    lastSuccess: undefined,
    lastError: undefined,
  };
  return { tick: () => tick(state, deps) };
}
