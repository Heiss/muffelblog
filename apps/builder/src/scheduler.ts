export interface Source {
  name: string;
  /**
   * A marker of the current content of the source (a fingerprint). Throws if
   * the source cannot be read completely; that is never treated as a change.
   */
  poll(): Promise<string>;
}

export interface Status {
  state: 'ok' | 'failing';
  lastCheck: string;
  lastSuccess?: { id: string; at: string };
  lastError?: { message: string; at: string; since: string };
}

export interface AlertEvent {
  kind: 'failed' | 'recovered';
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

/**
 * One check of all sources per `tick()`. A change is built only after it stayed
 * the same for `debounceChecks` further checks, so half-synchronized files are
 * not published. A source that cannot be read or a failed build keeps the last
 * good release online; a failure is reported once and its end once.
 */
export function createScheduler(deps: SchedulerDeps) {
  let loaded = false;
  let builtMarker: string | undefined;
  let pending: { marker: string; seen: number } | undefined;
  let lastSuccess: Status['lastSuccess'];
  let failingSince: string | undefined;
  let lastError: Status['lastError'];

  async function fail(error: unknown, at: string): Promise<void> {
    const text = message(error);
    const first = failingSince === undefined;
    failingSince ??= at;
    lastError = { message: text, at, since: failingSince };
    await deps.writeStatus({
      state: 'failing',
      lastCheck: at,
      lastSuccess,
      lastError,
    });
    if (first) await deps.alert({ kind: 'failed', message: text, at });
  }

  async function ok(at: string): Promise<void> {
    if (failingSince !== undefined) {
      failingSince = undefined;
      lastError = undefined;
      await deps.alert({
        kind: 'recovered',
        message: 'The sources and the build work again',
        at,
      });
    }
    await deps.writeStatus({ state: 'ok', lastCheck: at, lastSuccess });
  }

  return {
    async tick(): Promise<TickResult> {
      const at = deps.now().toISOString();
      if (!loaded) {
        builtMarker = (await deps.loadState()).builtMarker;
        loaded = true;
      }

      let marker: string;
      try {
        const markers = await Promise.all(
          deps.sources.map(async (s) => `${s.name}=${await s.poll()}`),
        );
        marker = markers.join('\n');
      } catch (error) {
        await fail(error, at);
        return 'poll-failed';
      }

      const online = await deps.hasRelease();
      if (online && marker === builtMarker) {
        pending = undefined;
        await ok(at);
        return 'idle';
      }

      // Nothing online yet: build at once. Otherwise wait until the content
      // stayed the same for the configured number of checks.
      if (online) {
        if (pending?.marker === marker) pending.seen += 1;
        else pending = { marker, seen: 0 };
        if (pending.seen < deps.debounceChecks) {
          await ok(at);
          return 'waiting';
        }
      }

      try {
        const id = await deps.build();
        builtMarker = marker;
        pending = undefined;
        lastSuccess = { id, at };
        await deps.saveState({ builtMarker: marker });
      } catch (error) {
        await fail(error, at);
        return 'failed';
      }
      await ok(at);
      return 'built';
    },
  };
}
