import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@muffelblog/core';
import type { Status } from './scheduler.ts';
import {
  alerter,
  buildEnv,
  builderDirs,
  nextcloudSource,
  noAvxHint,
  optionalSearch,
  pagefindCommand,
  polledSources,
  receiver,
  releaseOnline,
  requireSiteUrl,
  searchReporter,
  single,
  statusWriter,
  writableDirs,
} from './wiring.ts';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'wiring-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const remote = (files: { path: string; size: number; modTime: string }[]) => ({
  list: async () => files,
  download: async () => {},
});

describe('builderDirs', () => {
  it('has defaults and takes the variables', () => {
    expect(builderDirs({}).releasesDir).toBe('/data/releases');
    expect(builderDirs({ STATE_DIR: '/s', REPO_DIR: '/r' })).toMatchObject({
      stateDir: '/s',
      repoRoot: '/r',
    });
  });
});

describe('releaseOnline', () => {
  it('is true only when the current release has a build.json', async () => {
    const online = releaseOnline(dir);
    expect(await online()).toBe(false);
    await mkdir(path.join(dir, 'r1'));
    await writeFile(path.join(dir, 'r1', 'build.json'), '{}');
    await symlink('r1', path.join(dir, 'current'));
    expect(await online()).toBe(true);
  });
});

describe('sources', () => {
  it('refuses an empty Nextcloud share instead of treating it as "everything deleted"', async () => {
    await expect(nextcloudSource(remote([])).poll()).rejects.toThrow(/empty/);
    const marker = await nextcloudSource(
      remote([{ path: 'a.md', size: 1, modTime: '2026-11-05T10:00:00Z' }]),
    ).poll();
    expect(marker).toMatch(/\w+/);
  });

  it('checks Nextcloud, Memos and the comments only when they are set up', () => {
    const settings = DEFAULT_SETTINGS;
    expect(polledSources({ real: false, settings }, {})).toEqual([]);
    const all = polledSources(
      {
        remote: remote([]),
        real: true,
        settings,
        remarkUrl: 'http://remark42:8080',
      },
      { MEMOS_URL: 'http://memos:5230' },
    );
    expect(all.map((s) => s.name)).toEqual(['nextcloud', 'memos', 'comments']);
    // Memos only for real sources
    expect(
      polledSources({ real: false, settings }, { MEMOS_URL: 'http://m' }),
    ).toEqual([]);
  });
});

describe('buildEnv', () => {
  it('gives the site build no secret of the builder', () => {
    const env = buildEnv({
      NEXTCLOUD_SHARE_PASSWORD: 'a',
      NEXTCLOUD_SHARE_PASSWORD_FILE: 'b',
      NEXTCLOUD_SHARE_TOKEN: 'c',
      WEBMENTION_IO_TOKEN: 'd',
      REMARK_ADMIN_PASSWD: 'e',
      SITE_URL: 'https://b.example',
    });
    expect(env).toEqual({ SITE_URL: 'https://b.example' });
  });
});

describe('statusWriter', () => {
  const status: Status = {
    state: 'ok',
    lastCheck: '2026-11-05T10:00:00Z',
  } as Status;

  it('writes the status, later with the webmention totals', async () => {
    const written: unknown[] = [];
    const w = statusWriter({
      writeStatus: async (s) => {
        written.push(s);
      },
      releasesDir: dir,
      checkIntervalSeconds: 180,
      log: () => {},
    });
    await w.webmentions({
      lastRun: 'x',
      sent: 1,
      failed: 0,
      givenUp: 0,
      noEndpoint: 0,
    });
    expect(written).toEqual([]);
    await w.write(status);
    await w.webmentions({
      lastRun: 'y',
      sent: 2,
      failed: 0,
      givenUp: 0,
      noEndpoint: 0,
    });
    expect(written).toHaveLength(2);
    expect(written[1]).toMatchObject({ state: 'ok', webmentions: { sent: 2 } });
  });

  it('logs a problem with health.json and goes on', async () => {
    const lines: string[] = [];
    await writeFile(path.join(dir, 'current'), 'not a link');
    const w = statusWriter({
      writeStatus: async () => {},
      releasesDir: path.join(dir, 'current', 'below-a-file'),
      checkIntervalSeconds: 180,
      log: (l) => lines.push(l),
    });
    await w.write(status);
    expect(lines.join()).not.toMatch(/undefined/);
  });
});

describe('alerter and requireSiteUrl', () => {
  it('logs every event, also without a webhook', async () => {
    const lines: string[] = [];
    await alerter(undefined, (l) => lines.push(l))({
      kind: 'failed',
      message: 'boom',
      at: 'now',
    });
    expect(lines).toEqual(['failed: boom']);
  });

  it('needs an absolute address of the blog for sending', () => {
    expect(() => requireSiteUrl('')).toThrow(/SITE_URL/);
    expect(() => requireSiteUrl('https://b.example')).not.toThrow();
  });
});

describe('receiver', () => {
  const base = {
    stateDir: '/tmp/x',
    siteUrl: 'https://b.example',
    remarkUrl: 'http://remark42:8080',
    log: () => {},
  };
  const on = { ...DEFAULT_SETTINGS, webmentionsReceive: true };

  it('is off by default', () => {
    expect(
      receiver({ ...base, settings: DEFAULT_SETTINGS }, {}),
    ).toBeUndefined();
  });

  it('names every missing value', () => {
    expect(() =>
      receiver(
        { ...base, siteUrl: '', remarkUrl: undefined, settings: on },
        {},
      ),
    ).toThrow(
      'MUFFEL_WEBMENTIONS_RECEIVE=1 needs SITE_URL, WEBMENTION_IO_TOKEN, REMARK_INTERNAL_URL, REMARK_ADMIN_PASSWD',
    );
  });

  it('gives a runner when everything is there', () => {
    const r = receiver(
      { ...base, settings: on },
      { WEBMENTION_IO_TOKEN: 't', REMARK_ADMIN_PASSWD: 'p' },
    );
    expect(typeof r?.run).toBe('function');
  });
});

describe('single', () => {
  it('runs one at a time and logs a failure instead of throwing', async () => {
    let calls = 0;
    let release: () => void = () => {};
    const lines: string[] = [];
    const run = single(
      () =>
        new Promise<void>((resolve, reject) => {
          calls++;
          release = calls === 1 ? resolve : () => reject(new Error('down'));
        }),
      (l) => lines.push(l),
      'task',
    );
    const first = run();
    const again = run();
    expect(calls).toBe(1);
    release();
    await Promise.all([first, again]);
    const second = run();
    release();
    await second;
    expect(calls).toBe(2);
    expect(lines).toEqual(['task: run failed: down']);
  });
});

describe('writableDirs', () => {
  it('names the data folders, never the checkout of the code', () => {
    const dirs = builderDirs({ REPO_DIR: '/repo' });
    expect(writableDirs(dirs)).toEqual({
      releasesDir: '/data/releases',
      cacheDir: '/data/cache',
      stateDir: '/data/state',
    });
  });
});

describe('optionalSearch', () => {
  it('reports ok after a working index', async () => {
    const states: unknown[] = [];
    await optionalSearch(
      async () => {},
      (s) => states.push(s),
    );
    expect(states).toEqual([{ state: 'ok' }]);
  });

  it('reports a failure instead of throwing it', async () => {
    const states: unknown[] = [];
    await optionalSearch(
      async () => {
        throw new Error('pagefind exited with 1');
      },
      (s) => states.push(s),
    );
    await optionalSearch(
      async () => {
        throw 'plain';
      },
      (s) => states.push(s),
    );
    expect(states).toEqual([
      { state: 'failed', message: 'pagefind exited with 1' },
      { state: 'failed', message: 'plain' },
    ]);
  });
});

describe('searchReporter', () => {
  const setup = () => {
    const alerts: unknown[] = [];
    const states: unknown[] = [];
    const r = searchReporter({
      alert: async (e) => {
        alerts.push(e);
      },
      status: async (s) => {
        states.push(s);
      },
      now: () => new Date('2026-11-06T01:00:00Z'),
    });
    return { r, alerts, states };
  };

  it('does nothing before a release was built', async () => {
    const { r, alerts, states } = setup();
    await r.online();
    expect([alerts, states]).toEqual([[], []]);
  });

  it('alerts once per failure and takes each state into the status', async () => {
    const { r, alerts, states } = setup();
    const failed = { state: 'failed' as const, message: 'boom' };
    r.note(failed);
    await r.online();
    r.note(failed);
    await r.online();
    r.note({ state: 'ok' });
    await r.online();
    r.note(failed);
    await r.online();
    await r.online();
    expect(states).toEqual([failed, failed, { state: 'ok' }, failed]);
    const alert = {
      kind: 'search',
      message: 'The release is online without search: boom',
      at: '2026-11-06T01:00:00.000Z',
    };
    expect(alerts).toEqual([alert, alert]);
  });
});

describe('pagefindCommand', () => {
  it('runs the newest Pagefind, or the older one in the noavx image', () => {
    expect(pagefindCommand('/site', undefined)).toEqual({
      command: process.execPath,
      args: ['/site/node_modules/pagefind/lib/runner/bin.cjs'],
    });
    expect(pagefindCommand('/site', 'noavx').args).toEqual([
      '/site/node_modules/pagefind-noavx/lib/runner/bin.cjs',
    ]);
    expect(pagefindCommand('/site', 'other').args[0]).toContain(
      '/node_modules/pagefind/',
    );
  });
});

describe('noAvxHint', () => {
  const cpu = (flags: string) =>
    `processor\t: 0\nmodel name\t: x\nflags\t\t: ${flags}\nbugs\t\t: none\n`;

  it('names the noavx image on an x86 CPU without AVX', () => {
    const hint = noAvxHint(cpu('fpu sse4_2 avx512_vnni_x'), undefined);
    expect(hint).toBe(
      ' (this CPU has no AVX, which the search index of this image needs: use the image variant noavx, MUFFEL_VERSION=latest-noavx or <version>-noavx)',
    );
    expect(noAvxHint(cpu('fpu sse4_2'), '')).toBe(hint);
  });

  it('says nothing with AVX, without x86 flags or in the noavx image', () => {
    expect(noAvxHint(cpu('fpu avx avx2'), undefined)).toBe('');
    expect(noAvxHint(cpu('fpu sse4_2 avx'), undefined)).toBe('');
    expect(noAvxHint('Features\t: fp asimd\n', undefined)).toBe('');
    expect(noAvxHint('', undefined)).toBe('');
    expect(noAvxHint(cpu('fpu sse4_2'), 'noavx')).toBe('');
  });
});

describe('statusWriter: search', () => {
  it('adds the search state to every later status', async () => {
    const written: Status[] = [];
    const w = statusWriter({
      writeStatus: async (s) => {
        written.push(s);
      },
      releasesDir: dir,
      checkIntervalSeconds: 180,
      log: () => {},
    });
    await w.search({ state: 'ok' });
    expect(written).toEqual([]);
    const status = { state: 'ok', lastCheck: 'x' } as Status;
    await w.write(status);
    await w.search({ state: 'failed', message: 'boom' });
    expect(written).toEqual([
      { ...status, search: { state: 'ok' } },
      { ...status, search: { state: 'failed', message: 'boom' } },
    ]);
  });
});
