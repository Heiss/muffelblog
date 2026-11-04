import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRcloneRemote } from '../src/rclone.ts';
import { syncNextcloud } from '../src/nextcloud.ts';

// Contract test against a real Nextcloud (CI job "Contract tests"). It runs
// only if NEXTCLOUD_CONTRACT_URL is set; rclone must be installed.
const URL_ = process.env.NEXTCLOUD_CONTRACT_URL;
const ADMIN = process.env.NEXTCLOUD_CONTRACT_ADMIN ?? 'admin';
const ADMIN_PASSWORD = process.env.NEXTCLOUD_CONTRACT_PASSWORD ?? '';
const SHARE_PASSWORD = 'contract-share-password-1234';

const auth = `Basic ${Buffer.from(`${ADMIN}:${ADMIN_PASSWORD}`).toString('base64')}`;

async function dav(
  method: string,
  file: string,
  body?: string,
): Promise<number> {
  const res = await fetch(`${URL_}/remote.php/dav/files/${ADMIN}/${file}`, {
    method,
    headers: { Authorization: auth },
    body,
  });
  return res.status;
}

async function waitUntilInstalled(): Promise<void> {
  const until = Date.now() + 240_000;
  for (;;) {
    try {
      const res = await fetch(`${URL_}/status.php`);
      if (res.ok && ((await res.json()) as { installed?: boolean }).installed)
        return;
    } catch {
      /* not up yet */
    }
    if (Date.now() > until) throw new Error('Nextcloud did not come up');
    await new Promise((r) => setTimeout(r, 3000));
  }
}

async function createShare(folder: string): Promise<string> {
  const res = await fetch(
    `${URL_}/ocs/v2.php/apps/files_sharing/api/v1/shares`,
    {
      method: 'POST',
      headers: {
        Authorization: auth,
        'OCS-APIRequest': 'true',
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        path: `/${folder}`,
        shareType: '3',
        permissions: '1',
        password: SHARE_PASSWORD,
      }),
    },
  );
  const json = (await res.json()) as { ocs: { data: { token: string } } };
  return json.ocs.data.token;
}

describe.skipIf(!URL_)('Nextcloud public share through rclone', () => {
  it('lists, filters, syncs, detects changes and refuses a wrong password', async () => {
    await waitUntilInstalled();
    const folder = `blog-${Date.now()}`;
    expect(await dav('MKCOL', folder)).toBe(201);
    expect(await dav('MKCOL', `${folder}/sub`)).toBe(201);
    expect(await dav('MKCOL', `${folder}/.obsidian`)).toBe(201);
    expect(
      await dav('PUT', `${folder}/a.md`, '---\npublish: true\n---\nA'),
    ).toBe(201);
    expect(await dav('PUT', `${folder}/sub/b.md`, 'B')).toBe(201);
    expect(await dav('PUT', `${folder}/.obsidian/workspace.json`, '{}')).toBe(
      201,
    );
    const token = await createShare(folder);

    const config = { url: URL_ as string, token, password: SHARE_PASSWORD };
    const remote = createRcloneRemote(config);

    // Hidden folders are not part of the listing.
    const files = await remote.list();
    expect(files.map((f) => f.path).sort()).toEqual(['a.md', 'sub/b.md']);
    // getlastmodified arrives as a time stamp.
    for (const f of files)
      expect(Number.isNaN(Date.parse(f.modTime))).toBe(false);

    const root = await mkdtemp(path.join(tmpdir(), 'muffel-contract-'));
    const dirs = {
      cacheDir: path.join(root, 'cache'),
      stateDir: path.join(root, 'state'),
    };
    const first = await syncNextcloud({ remote, ...dirs });
    expect(first.changed).toBe(true);
    expect(first.files).toBe(2);

    expect((await syncNextcloud({ remote, ...dirs })).changed).toBe(false);

    // A change on the server (a new modification time) is noticed.
    await new Promise((r) => setTimeout(r, 1500));
    expect(
      await dav('PUT', `${folder}/a.md`, '---\npublish: true\n---\nA changed'),
    ).toBe(204);
    const third = await syncNextcloud({
      remote,
      ...dirs,
      now: new Date(Date.now() + 5000),
    });
    expect(third.changed).toBe(true);

    // A wrong password fails and leaves the cache as it was.
    const wrong = createRcloneRemote({ ...config, password: 'wrong-password' });
    await expect(syncNextcloud({ remote: wrong, ...dirs })).rejects.toThrow();
    expect((await syncNextcloud({ remote, ...dirs })).changed).toBe(false);
  });
});
