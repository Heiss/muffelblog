import { spawn } from 'node:child_process';
import { rcloneEnv } from './nextcloud.ts';
import type { NextcloudConfig, Remote, RemoteFile } from './nextcloud.ts';

/** Runs `rclone <args>` and returns its standard output. */
export type Exec = (
  args: string[],
  options: { env?: Record<string, string>; stdin?: string },
) => Promise<string>;

/** Hidden folders and files (`.obsidian/`, `.trash/`, ...) are never fetched or counted. */
export const EXCLUDES = ['.*/**', '.*'] as const;

const FLAGS = [
  '--retries',
  '3',
  '--low-level-retries',
  '3',
  '--timeout',
  '60s',
  '--contimeout',
  '30s',
] as const;

/** Real `rclone` in the PATH. Its error output is passed on without the environment. */
export const execRclone: Exec = (args, options) =>
  new Promise((resolve, reject) => {
    const child = spawn('rclone', args, {
      env: { ...process.env, ...options.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (err += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve(out)
        : reject(
            new Error(
              `rclone ${args[0] ?? ''} exited with ${code}: ${err.trim().split('\n').slice(-3).join(' | ')}`,
            ),
          ),
    );
    child.stdin.end(options.stdin ?? '');
  });

function excludeArgs(): string[] {
  return EXCLUDES.flatMap((pattern) => ['--exclude', pattern]);
}

/** The public share of a Nextcloud as a `Remote`, through rclone (WebDAV). */
export function createRcloneRemote(
  config: NextcloudConfig,
  exec: Exec = execRclone,
): Remote {
  let env: Record<string, string> | undefined;
  async function connection(): Promise<Record<string, string>> {
    if (!env) {
      // rclone wants its own "obscured" form of the password; stdin keeps it
      // out of the process list.
      const obscured = (
        await exec(['obscure', '-'], { stdin: config.password })
      ).trim();
      env = rcloneEnv(config, obscured);
    }
    return env;
  }

  return {
    async list(): Promise<RemoteFile[]> {
      const out = await exec(
        [
          'lsjson',
          '-R',
          '--files-only',
          '--no-mimetype',
          ...excludeArgs(),
          ...FLAGS,
          ':webdav:',
        ],
        { env: await connection() },
      );
      let parsed: unknown;
      try {
        parsed = JSON.parse(out);
      } catch {
        throw new Error('Unexpected answer of rclone lsjson (not JSON)');
      }
      if (!Array.isArray(parsed)) {
        throw new Error('Unexpected answer of rclone lsjson (not a list)');
      }
      return parsed.map((entry: unknown) => {
        const e = entry as Record<string, unknown>;
        if (
          typeof e.Path !== 'string' ||
          typeof e.Size !== 'number' ||
          typeof e.ModTime !== 'string'
        ) {
          throw new Error('Unexpected entry in the answer of rclone lsjson');
        }
        return { path: e.Path, size: e.Size, modTime: e.ModTime };
      });
    },

    async download(destDir: string): Promise<void> {
      await exec(['copy', ':webdav:', destDir, ...excludeArgs(), ...FLAGS], {
        env: await connection(),
      });
    },
  };
}
