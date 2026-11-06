import { describe, expect, it } from 'vitest';
import { createScheduler } from './scheduler.ts';
import type { AlertEvent, SchedulerDeps, Status } from './scheduler.ts';

interface Harness {
  deps: SchedulerDeps;
  builds: number;
  alerts: AlertEvent[];
  statuses: Status[];
  markers: Record<string, string>;
  failPoll: Set<string>;
  failBuild: { value: boolean };
  release: { exists: boolean };
  saved: { builtMarker?: string };
}

function harness(
  opts: {
    debounceChecks?: number;
    saved?: { builtMarker?: string };
    release?: boolean;
    sources?: string[];
  } = {},
): Harness {
  const markers: Record<string, string> = { nextcloud: 'n1', memos: 'm1' };
  const failPoll = new Set<string>();
  const failBuild = { value: false };
  const release = { exists: opts.release ?? false };
  const saved = { ...(opts.saved ?? {}) };
  const h: Harness = {
    builds: 0,
    alerts: [],
    statuses: [],
    markers,
    failPoll,
    failBuild,
    release,
    saved,
    deps: undefined as unknown as SchedulerDeps,
  };
  let t = 0;
  h.deps = {
    sources: (opts.sources ?? ['nextcloud', 'memos']).map((name) => ({
      name,
      poll: async () => {
        if (failPoll.has(name)) throw new Error(`${name} unreachable`);
        return markers[name] ?? '';
      },
    })),
    build: async () => {
      h.builds += 1;
      if (failBuild.value) throw new Error('build exploded');
      release.exists = true;
      return `release-${h.builds}`;
    },
    loadState: async () => ({ ...saved }),
    saveState: async (s) => {
      Object.assign(saved, s);
    },
    writeStatus: async (s) => {
      h.statuses.push(s);
    },
    alert: async (e) => {
      h.alerts.push(e);
    },
    hasRelease: async () => release.exists,
    debounceChecks: opts.debounceChecks ?? 1,
    now: () => new Date(Date.UTC(2026, 10, 4, 10, 0, (t += 180))),
  };
  return h;
}

describe('scheduler', () => {
  it('builds the first release at once: nothing is online that a half-synced file could spoil', async () => {
    const h = harness();
    const s = createScheduler(h.deps);
    expect(await s.tick()).toBe('built');
    expect(h.builds).toBe(1);
  });

  it('does not build without a change', async () => {
    const h = harness();
    const s = createScheduler(h.deps);
    await s.tick();
    expect(await s.tick()).toBe('idle');
    expect(await s.tick()).toBe('idle');
    expect(h.builds).toBe(1);
  });

  it('builds when a source changes, after the debounce', async () => {
    const h = harness();
    const s = createScheduler(h.deps);
    await s.tick();
    h.markers.memos = 'm2';
    expect(await s.tick()).toBe('waiting');
    expect(await s.tick()).toBe('built');
    expect(h.builds).toBe(2);
  });

  it('restarts the waiting when the files keep changing', async () => {
    const h = harness();
    const s = createScheduler(h.deps);
    await s.tick();
    h.markers.nextcloud = 'n2';
    expect(await s.tick()).toBe('waiting');
    h.markers.nextcloud = 'n3'; // still being written
    expect(await s.tick()).toBe('waiting');
    expect(h.builds).toBe(1);
    expect(await s.tick()).toBe('built');
    expect(h.builds).toBe(2);
  });

  it('with no debounce builds at the first sighting', async () => {
    const h = harness({ debounceChecks: 0 });
    const s = createScheduler(h.deps);
    expect(await s.tick()).toBe('built');
    h.markers.memos = 'm2';
    expect(await s.tick()).toBe('built');
  });

  it('with a longer debounce waits for several equal checks', async () => {
    const h = harness({ debounceChecks: 2 });
    const s = createScheduler(h.deps);
    await s.tick();
    h.markers.memos = 'm2';
    expect(await s.tick()).toBe('waiting');
    expect(await s.tick()).toBe('waiting');
    expect(await s.tick()).toBe('built');
  });

  it('remembers the built state over a restart: no build, if nothing changed', async () => {
    const first = harness();
    const s1 = createScheduler(first.deps);
    await s1.tick();
    const second = harness({ saved: first.saved, release: true });
    const s2 = createScheduler(second.deps);
    expect(await s2.tick()).toBe('idle');
    expect(second.builds).toBe(0);
  });

  it('builds again after a restart if the release folder is gone', async () => {
    const first = harness();
    const s1 = createScheduler(first.deps);
    await s1.tick();
    const second = harness({ saved: first.saved, release: false });
    const s2 = createScheduler(second.deps);
    expect(await s2.tick()).toBe('built');
  });

  it('does not build and reports when a source cannot be read', async () => {
    const h = harness();
    const s = createScheduler(h.deps);
    await s.tick();
    h.markers.memos = 'm2';
    h.failPoll.add('memos');
    expect(await s.tick()).toBe('poll-failed');
    expect(h.builds).toBe(1);
    expect(h.alerts.map((a) => a.kind)).toEqual(['failed']);
    expect(h.alerts[0]?.message).toContain('memos unreachable');
  });

  it('an unreachable source never counts as "everything deleted"', async () => {
    const h = harness();
    const s = createScheduler(h.deps);
    await s.tick();
    h.failPoll.add('nextcloud');
    h.markers.nextcloud = '';
    for (let i = 0; i < 3; i++) expect(await s.tick()).toBe('poll-failed');
    expect(h.builds).toBe(1);
  });

  it('reports a failed build once, keeps trying, and reports the recovery', async () => {
    const h = harness({ debounceChecks: 0 });
    const s = createScheduler(h.deps);
    expect(await s.tick()).toBe('built');
    h.markers.nextcloud = 'n2';
    h.failBuild.value = true;
    expect(await s.tick()).toBe('failed');
    expect(await s.tick()).toBe('failed');
    expect(await s.tick()).toBe('failed');
    expect(h.alerts.map((a) => a.kind)).toEqual(['failed']);
    h.failBuild.value = false;
    expect(await s.tick()).toBe('built');
    expect(h.alerts.map((a) => a.kind)).toEqual(['failed', 'recovered']);
  });

  it('writes a status with last success and last error', async () => {
    const h = harness({ debounceChecks: 0 });
    const s = createScheduler(h.deps);
    await s.tick();
    expect(h.statuses.at(-1)).toMatchObject({
      state: 'ok',
      lastSuccess: { id: 'release-1' },
    });
    h.markers.nextcloud = 'n2';
    h.failBuild.value = true;
    await s.tick();
    const status = h.statuses.at(-1);
    expect(status).toMatchObject({
      state: 'failing',
      lastSuccess: { id: 'release-1' },
    });
    expect(status?.lastError?.message).toContain('build exploded');
  });

  it('works without any polled source (demo set): one build, then idle', async () => {
    const h = harness({ sources: [], debounceChecks: 1 });
    const s = createScheduler(h.deps);
    expect(await s.tick()).toBe('built');
    expect(await s.tick()).toBe('idle');
  });
});

describe('forced build', () => {
  it('rebuilds unchanged sources immediately and persists the resulting marker', async () => {
    const h = harness({ debounceChecks: 5 });
    const scheduler = createScheduler(h.deps);
    await scheduler.tick();
    expect(await scheduler.tick()).toBe('idle');
    expect(await scheduler.tick({ force: true })).toBe('built');
    expect(h.builds).toBe(2);
    expect(await createScheduler(h.deps).tick()).toBe('idle');
  });
  it('still requires readable sources and preserves state after a failed build', async () => {
    const h = harness();
    const scheduler = createScheduler(h.deps);
    await scheduler.tick();
    const saved = { ...h.saved };
    h.failPoll.add('memos');
    expect(await scheduler.tick({ force: true })).toBe('poll-failed');
    expect(h.builds).toBe(1);
    h.failPoll.clear();
    h.failBuild.value = true;
    expect(await scheduler.tick({ force: true })).toBe('failed');
    expect(h.saved).toEqual(saved);
  });
});
