import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { pruneReleases, releaseId, swapCurrent } from './release.ts';

export interface NextcloudConfig {
  /** Address of the Nextcloud, without the trailing slash. */
  url: string;
  /** Token of the public share (the WebDAV user). */
  token: string;
  /** Password of the share (a secret, never logged). */
  password: string;
}

/**
 * Nextcloud is a source only when `NEXTCLOUD_URL` is set. Everything else is
 * then required, a mistake stops the build before anything is fetched.
 * The password comes from `NEXTCLOUD_SHARE_PASSWORD` or, for Docker secrets,
 * from the file named by `NEXTCLOUD_SHARE_PASSWORD_FILE`.
 */
export function nextcloudConfig(
  env: Record<string, string | undefined> = process.env,
): NextcloudConfig | undefined {
  const rawUrl = env.NEXTCLOUD_URL?.trim();
  if (!rawUrl) return undefined;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`NEXTCLOUD_URL is not an address: ${rawUrl}`);
  }
  if (
    (url.protocol !== 'https:' && url.protocol !== 'http:') ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new Error(
      `NEXTCLOUD_URL must be like https://cloud.example.org (no login, query or fragment): ${rawUrl}`,
    );
  }

  const token = env.NEXTCLOUD_SHARE_TOKEN?.trim() ?? '';
  if (!/^[A-Za-z0-9]{3,64}$/.test(token)) {
    throw new Error(
      'NEXTCLOUD_SHARE_TOKEN is missing or not a share token (letters and digits only)',
    );
  }

  let password = env.NEXTCLOUD_SHARE_PASSWORD ?? '';
  const file = env.NEXTCLOUD_SHARE_PASSWORD_FILE?.trim();
  if (password !== '' && file) {
    throw new Error(
      'Set either NEXTCLOUD_SHARE_PASSWORD or NEXTCLOUD_SHARE_PASSWORD_FILE, not both',
    );
  }
  if (file) {
    try {
      password = readFileSync(file, 'utf8').replace(/\r?\n$/, '');
    } catch (error) {
      throw new Error(
        `NEXTCLOUD_SHARE_PASSWORD_FILE could not be read: ${file}`,
        { cause: error },
      );
    }
  }
  if (password === '') {
    // The share link gives access to the whole folder, the password is the
    // only protection (see okf/content/nextcloud-source.md).
    throw new Error(
      'NEXTCLOUD_SHARE_PASSWORD (or NEXTCLOUD_SHARE_PASSWORD_FILE) is required',
    );
  }

  return {
    url: url.href.replace(/\/+$/, ''),
    token,
    password,
  };
}

/** rclone reads its connection from the environment, so the password stays out of the process list. */
export function rcloneEnv(
  config: NextcloudConfig,
  obscuredPassword: string,
): Record<string, string> {
  return {
    RCLONE_WEBDAV_URL: `${config.url}/public.php/webdav/`,
    RCLONE_WEBDAV_VENDOR: 'nextcloud',
    RCLONE_WEBDAV_USER: config.token,
    RCLONE_WEBDAV_PASS: obscuredPassword,
  };
}

export interface RemoteFile {
  /** Path inside the share, with `/` as the separator. */
  path: string;
  size: number;
  /** Modification time as reported by the server (`getlastmodified`). */
  modTime: string;
}

export interface Remote {
  list(): Promise<RemoteFile[]>;
  /** Copies the complete (filtered) share into an existing empty folder. */
  download(destDir: string): Promise<void>;
}

/** Stable summary of a file list: same files, same sizes and times, same value. */
export function fingerprint(files: readonly RemoteFile[]): string {
  const lines = files.map((f) => `${f.path}\t${f.size}\t${f.modTime}`).sort();
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

interface State {
  fingerprint: string;
  files: number;
}

async function readState(file: string): Promise<State | undefined> {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as State;
    return typeof parsed.fingerprint === 'string' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

async function walk(root: string, rel = ''): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  for (const entry of await readdir(path.join(root, rel), {
    withFileTypes: true,
  })) {
    const relPath = rel === '' ? entry.name : `${rel}/${entry.name}`;
    if (entry.isDirectory()) {
      for (const [k, v] of await walk(root, relPath)) result.set(k, v);
    } else if (entry.isFile()) {
      result.set(relPath, (await stat(path.join(root, relPath))).size);
    }
  }
  return result;
}

function assertSafePaths(files: readonly RemoteFile[]): void {
  for (const f of files) {
    const parts = f.path.split('/');
    if (
      f.path === '' ||
      f.path.startsWith('/') ||
      f.path.includes('\\') ||
      parts.some((p) => p === '..' || p === '.' || p === '')
    ) {
      throw new Error(`Unsafe path in the file list: "${f.path}"`);
    }
  }
}

export interface SyncOptions {
  remote: Remote;
  /** Parent of `nextcloud/` with the copies and the link `current`. */
  cacheDir: string;
  /** Where the last fingerprint is remembered. */
  stateDir: string;
  /** Copies kept (the current one plus older ones). Default 2. */
  keep?: number;
  now?: Date;
}

export interface SyncResult {
  changed: boolean;
  files: number;
  /** Folder with the content: `<cacheDir>/nextcloud/current`. */
  contentDir: string;
}

/**
 * Fetches the share if (and only if) it changed.
 *
 * Safety rules: the listing is compared first, a download goes into a new
 * folder and is checked against the listing before `current` is switched, and
 * an empty listing is an error (never "everything was deleted"). On any failure
 * the cache and the remembered state stay as they were.
 */
export async function syncNextcloud(options: SyncOptions): Promise<SyncResult> {
  const root = path.join(options.cacheDir, 'nextcloud');
  const contentDir = path.join(root, 'current');
  const stateFile = path.join(options.stateDir, 'nextcloud.json');
  const previous = await readState(stateFile);

  const files = await options.remote.list();
  assertSafePaths(files);
  if (files.length === 0) {
    throw new Error(
      'The share is empty (refused: an empty list is never treated as "everything deleted")',
    );
  }

  const print = fingerprint(files);
  const present = await stat(contentDir).then(
    (s) => s.isDirectory(),
    () => false,
  );
  if (previous?.fingerprint === print && present) {
    return { changed: false, files: files.length, contentDir };
  }

  await mkdir(root, { recursive: true });
  const id = releaseId(options.now ?? new Date());
  const target = path.join(root, id);
  await rm(target, { recursive: true, force: true });
  await mkdir(target);
  try {
    await options.remote.download(target);
    const got = await walk(target);
    const expected = new Map(files.map((f) => [f.path, f.size]));
    const same =
      got.size === expected.size &&
      [...expected].every(([p, size]) => got.get(p) === size);
    if (!same) {
      throw new Error(
        `The download is incomplete or differs from the listing (${got.size} of ${expected.size} files)`,
      );
    }
    await swapCurrent(root, id);
  } catch (error) {
    await rm(target, { recursive: true, force: true });
    throw error;
  }
  await pruneReleases(root, options.keep ?? 2);
  await mkdir(options.stateDir, { recursive: true });
  await writeFile(
    stateFile,
    JSON.stringify({ fingerprint: print, files: files.length }) + '\n',
  );
  return { changed: true, files: files.length, contentDir };
}

/**
 * Real sources and sample data never mix: with `NEXTCLOUD_URL` the sample set
 * would silently win (it is checked first), so that combination stops the build.
 */
export function assertNoFixtures(
  env: Record<string, string | undefined> = process.env,
): void {
  if (env.NEXTCLOUD_URL?.trim() && env.MUFFEL_FIXTURES?.trim()) {
    throw new Error(
      'NEXTCLOUD_URL and MUFFEL_FIXTURES are both set: set MUFFEL_FIXTURES empty to use the real sources',
    );
  }
}
