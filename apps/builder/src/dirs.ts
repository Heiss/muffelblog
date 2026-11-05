import { access, constants, mkdir } from 'node:fs/promises';

export interface DirDeps {
  /** Creates a folder if it is missing. A failure here is not an error: the write check follows. */
  ensure: (dir: string) => Promise<unknown>;
  access: (dir: string) => Promise<unknown>;
  uid: number;
  gid: number;
}

const defaults: DirDeps = {
  ensure: (dir) => mkdir(dir, { recursive: true }),
  access: (dir) => access(dir, constants.W_OK),
  uid: process.getuid?.() ?? 0,
  gid: process.getgid?.() ?? 0,
};

/**
 * The builder does not run as root. A volume or host folder that an older
 * version created belongs to root and cannot be written, which would show up as
 * an obscure error in the middle of a build. This checks at the start and says
 * what to do.
 */
export async function assertWritable(
  dirs: Record<string, string>,
  deps: DirDeps = defaults,
): Promise<void> {
  const blocked: string[] = [];
  for (const dir of Object.values(dirs)) {
    await Promise.resolve(deps.ensure(dir)).catch(() => undefined);
    try {
      await deps.access(dir);
    } catch {
      blocked.push(dir);
    }
  }
  if (blocked.length === 0) return;
  const owner = `${deps.uid}:${deps.gid}`;
  throw new Error(
    `${blocked.join(', ')} ${blocked.length === 1 ? 'is' : 'are'} not writable for the builder (uid ${deps.uid}, not root). ` +
      `The folder belongs to another user, probably root from an older version. Fix the owner once: ` +
      `for the Docker volumes run: docker compose run --rm --no-deps --user root --entrypoint chown builder -R ${owner} ${blocked.join(' ')} ; ` +
      `for a folder on the host (MUFFEL_RELEASES_DIR) run: sudo chown -R ${owner} <that folder>`,
  );
}
