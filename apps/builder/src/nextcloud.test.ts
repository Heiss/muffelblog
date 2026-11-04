import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertNoFixtures,
  fingerprint,
  nextcloudConfig,
  rcloneEnv,
  syncNextcloud,
} from './nextcloud.ts';
import type { Remote, RemoteFile } from './nextcloud.ts';

describe('nextcloudConfig', () => {
  const base = {
    NEXTCLOUD_URL: 'https://cloud.example.org',
    NEXTCLOUD_SHARE_TOKEN: 'AbC123xyz',
    NEXTCLOUD_SHARE_PASSWORD: 'secret',
  };

  it('is off without NEXTCLOUD_URL', () => {
    expect(nextcloudConfig({})).toBeUndefined();
    expect(nextcloudConfig({ NEXTCLOUD_URL: ' ' })).toBeUndefined();
  });

  it('reads url, token and password', async () => {
    expect(await nextcloudConfig(base)).toEqual({
      url: 'https://cloud.example.org',
      token: 'AbC123xyz',
      password: 'secret',
    });
  });

  it('keeps a sub path and drops the trailing slash', async () => {
    const c = await nextcloudConfig({
      ...base,
      NEXTCLOUD_URL: 'https://example.org/nextcloud/',
    });
    expect(c?.url).toBe('https://example.org/nextcloud');
  });

  it('reads the password from a file (Docker secret)', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'muffel-nc-'));
    const file = path.join(dir, 'pw');
    await writeFile(file, 'from-file\n');
    const c = await nextcloudConfig({
      NEXTCLOUD_URL: base.NEXTCLOUD_URL,
      NEXTCLOUD_SHARE_TOKEN: base.NEXTCLOUD_SHARE_TOKEN,
      NEXTCLOUD_SHARE_PASSWORD_FILE: file,
    });
    expect(c?.password).toBe('from-file');
  });

  it('stops the build when something is missing or odd', async () => {
    const bad: Record<string, string>[] = [
      { ...base, NEXTCLOUD_SHARE_TOKEN: '' },
      { ...base, NEXTCLOUD_SHARE_PASSWORD: '' },
      { ...base, NEXTCLOUD_URL: 'nonsense' },
      { ...base, NEXTCLOUD_URL: 'ftp://x.example' },
      { ...base, NEXTCLOUD_URL: 'https://x.example/?a=1' },
      { ...base, NEXTCLOUD_URL: 'https://u:p@x.example' },
      { ...base, NEXTCLOUD_SHARE_TOKEN: 'a/b' },
      {
        ...base,
        NEXTCLOUD_SHARE_PASSWORD: '',
        NEXTCLOUD_SHARE_PASSWORD_FILE: '/nonexistent/pw',
      },
      { ...base, NEXTCLOUD_SHARE_PASSWORD_FILE: '/some/file' }, // both set
    ];
    for (const env of bad) {
      await expect(
        Promise.resolve().then(() => nextcloudConfig(env)),
        JSON.stringify(env),
      ).rejects.toThrow(/NEXTCLOUD/);
    }
  });

  it('refuses a password without a share password being set at all', async () => {
    const rest: Record<string, string | undefined> = { ...base };
    delete rest.NEXTCLOUD_SHARE_PASSWORD;
    await expect(
      Promise.resolve().then(() => nextcloudConfig(rest)),
    ).rejects.toThrow(/NEXTCLOUD_SHARE_PASSWORD/);
  });
});

describe('rcloneEnv', () => {
  it('passes the connection through the environment, not the arguments', () => {
    const env = rcloneEnv(
      { url: 'https://c.example', token: 'tok', password: 'x' },
      'OBSCURED',
    );
    expect(env).toMatchObject({
      RCLONE_WEBDAV_URL: 'https://c.example/public.php/webdav/',
      RCLONE_WEBDAV_VENDOR: 'nextcloud',
      RCLONE_WEBDAV_USER: 'tok',
      RCLONE_WEBDAV_PASS: 'OBSCURED',
    });
    expect(JSON.stringify(env)).not.toContain('"x"');
  });
});

describe('fingerprint', () => {
  const f = (
    p: string,
    size = 1,
    modTime = '2026-01-01T00:00:00Z',
  ): RemoteFile => ({ path: p, size, modTime });

  it('does not depend on the order', () => {
    expect(fingerprint([f('a'), f('b')])).toBe(fingerprint([f('b'), f('a')]));
  });
  it('changes with size, time, name and number of files', () => {
    const base = fingerprint([f('a')]);
    expect(fingerprint([f('a', 2)])).not.toBe(base);
    expect(fingerprint([f('a', 1, '2026-01-02T00:00:00Z')])).not.toBe(base);
    expect(fingerprint([f('b')])).not.toBe(base);
    expect(fingerprint([f('a'), f('b')])).not.toBe(base);
  });
});

/** A remote with fixed files whose content is the path. */
function fakeRemote(
  files: RemoteFile[],
  opts: { failList?: boolean; failDownload?: boolean; skip?: string } = {},
): Remote {
  return {
    async list() {
      if (opts.failList) throw new Error('list failed');
      return files;
    },
    async download(dest) {
      for (const file of files) {
        if (file.path === opts.skip) continue;
        const target = path.join(dest, file.path);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, 'x'.repeat(file.size));
      }
      if (opts.failDownload) throw new Error('download failed');
    },
  };
}

const file = (
  p: string,
  size = 3,
  modTime = '2026-01-01T00:00:00Z',
): RemoteFile => ({ path: p, size, modTime });

async function dirs(): Promise<{ cacheDir: string; stateDir: string }> {
  const root = await mkdtemp(path.join(tmpdir(), 'muffel-sync-'));
  return {
    cacheDir: path.join(root, 'cache'),
    stateDir: path.join(root, 'state'),
  };
}

describe('syncNextcloud', () => {
  it('downloads on the first run and points current at the result', async () => {
    const d = await dirs();
    const r = await syncNextcloud({
      remote: fakeRemote([file('a.md'), file('sub/b.md')]),
      ...d,
    });
    expect(r.changed).toBe(true);
    const current = path.join(d.cacheDir, 'nextcloud', 'current');
    expect((await readdir(current)).sort()).toEqual(['a.md', 'sub']);
    expect(await readFile(path.join(current, 'a.md'), 'utf8')).toBe('xxx');
  });

  it('does nothing when nothing changed', async () => {
    const d = await dirs();
    const remote = fakeRemote([file('a.md')]);
    await syncNextcloud({ remote, ...d });
    const before = await readlink(
      path.join(d.cacheDir, 'nextcloud', 'current'),
    );
    const r = await syncNextcloud({ remote, ...d });
    expect(r.changed).toBe(false);
    expect(await readlink(path.join(d.cacheDir, 'nextcloud', 'current'))).toBe(
      before,
    );
  });

  it('syncs again after a change and keeps the old copy for one more round', async () => {
    const d = await dirs();
    await syncNextcloud({
      remote: fakeRemote([file('a.md')]),
      ...d,
      now: new Date('2026-11-04T10:00:00Z'),
    });
    const r = await syncNextcloud({
      remote: fakeRemote([file('a.md', 5)]),
      ...d,
      now: new Date('2026-11-04T10:03:00Z'),
    });
    expect(r.changed).toBe(true);
    const current = path.join(d.cacheDir, 'nextcloud', 'current');
    expect((await readFile(path.join(current, 'a.md'), 'utf8')).length).toBe(5);
    const kept = (await readdir(path.join(d.cacheDir, 'nextcloud'))).filter(
      (n) => n !== 'current',
    );
    expect(kept.length).toBe(2);
  });

  it('leaves the cache unchanged when listing fails', async () => {
    const d = await dirs();
    await syncNextcloud({ remote: fakeRemote([file('a.md')]), ...d });
    const before = await readlink(
      path.join(d.cacheDir, 'nextcloud', 'current'),
    );
    await expect(
      syncNextcloud({
        remote: fakeRemote([file('a.md', 9)], { failList: true }),
        ...d,
      }),
    ).rejects.toThrow('list failed');
    expect(await readlink(path.join(d.cacheDir, 'nextcloud', 'current'))).toBe(
      before,
    );
  });

  it('leaves the cache unchanged when the download fails and cleans up', async () => {
    const d = await dirs();
    await syncNextcloud({
      remote: fakeRemote([file('a.md')]),
      ...d,
      now: new Date('2026-11-04T10:00:00Z'),
    });
    const before = await readlink(
      path.join(d.cacheDir, 'nextcloud', 'current'),
    );
    await expect(
      syncNextcloud({
        remote: fakeRemote([file('a.md', 9)], { failDownload: true }),
        ...d,
        now: new Date('2026-11-04T10:03:00Z'),
      }),
    ).rejects.toThrow('download failed');
    expect(await readlink(path.join(d.cacheDir, 'nextcloud', 'current'))).toBe(
      before,
    );
    expect((await readdir(path.join(d.cacheDir, 'nextcloud'))).sort()).toEqual(
      [before, 'current'].sort(),
    );
    // The failed run is not remembered: the next run tries again.
    const again = await syncNextcloud({
      remote: fakeRemote([file('a.md', 9)]),
      ...d,
      now: new Date('2026-11-04T10:06:00Z'),
    });
    expect(again.changed).toBe(true);
  });

  it('refuses an incomplete download', async () => {
    const d = await dirs();
    await expect(
      syncNextcloud({
        remote: fakeRemote([file('a.md'), file('b.md')], { skip: 'b.md' }),
        ...d,
      }),
    ).rejects.toThrow(/incomplete/i);
    await expect(
      readlink(path.join(d.cacheDir, 'nextcloud', 'current')),
    ).rejects.toThrow();
  });

  it('refuses a download whose file sizes differ from the listing', async () => {
    const d = await dirs();
    const remote: Remote = {
      list: async () => [file('a.md', 3)],
      download: async (dest) =>
        writeFile(path.join(dest, 'a.md'), 'only-this-long'),
    };
    await expect(syncNextcloud({ remote, ...d })).rejects.toThrow(
      /incomplete/i,
    );
  });

  it('never treats an empty list as "everything was deleted"', async () => {
    const d = await dirs();
    await syncNextcloud({ remote: fakeRemote([file('a.md')]), ...d });
    const before = await readlink(
      path.join(d.cacheDir, 'nextcloud', 'current'),
    );
    await expect(
      syncNextcloud({ remote: fakeRemote([]), ...d }),
    ).rejects.toThrow(/empty/i);
    expect(await readlink(path.join(d.cacheDir, 'nextcloud', 'current'))).toBe(
      before,
    );
  });

  it('treats an empty share as an error on the first run too', async () => {
    const d = await dirs();
    await expect(
      syncNextcloud({ remote: fakeRemote([]), ...d }),
    ).rejects.toThrow(/empty/i);
  });

  it('rejects files that would leave the folder', async () => {
    const d = await dirs();
    const remote: Remote = {
      list: async () => [file('../evil.md')],
      download: async () => undefined,
    };
    await expect(syncNextcloud({ remote, ...d })).rejects.toThrow(/path/i);
  });
});

describe('assertNoFixtures', () => {
  it('allows either one alone', () => {
    expect(() => assertNoFixtures({ MUFFEL_FIXTURES: 'demo' })).not.toThrow();
    expect(() =>
      assertNoFixtures({ NEXTCLOUD_URL: 'https://c.example' }),
    ).not.toThrow();
    expect(() =>
      assertNoFixtures({
        NEXTCLOUD_URL: 'https://c.example',
        MUFFEL_FIXTURES: '',
      }),
    ).not.toThrow();
  });
  it('stops the build when both are set', () => {
    expect(() =>
      assertNoFixtures({
        NEXTCLOUD_URL: 'https://c.example',
        MUFFEL_FIXTURES: 'demo',
      }),
    ).toThrow(/MUFFEL_FIXTURES/);
  });
});
