import { describe, expect, it } from 'vitest';
import { EXCLUDES, createRcloneRemote } from './rclone.ts';
import type { Exec } from './rclone.ts';

const config = {
  url: 'https://c.example',
  token: 'tok',
  password: 'p@ss word',
};

function recorder(outputs: Record<string, string>) {
  const calls: {
    args: string[];
    env: Record<string, string>;
    stdin?: string;
  }[] = [];
  const exec: Exec = async (args, opts) => {
    calls.push({ args, env: opts.env ?? {}, stdin: opts.stdin });
    return outputs[args[0] ?? ''] ?? '';
  };
  return { calls, exec };
}

describe('createRcloneRemote', () => {
  it('obscures the password through stdin and never puts it into arguments', async () => {
    const { calls, exec } = recorder({ obscure: 'OBSCURED\n', lsjson: '[]' });
    await createRcloneRemote(config, exec).list();
    const obscure = calls.find((c) => c.args[0] === 'obscure');
    expect(obscure?.stdin).toBe('p@ss word');
    expect(obscure?.args).toEqual(['obscure', '-']);
    for (const c of calls) {
      expect(c.args.join(' ')).not.toContain('p@ss word');
      expect(JSON.stringify(c.env)).not.toContain('p@ss word');
    }
    const ls = calls.find((c) => c.args[0] === 'lsjson');
    expect(ls?.env.RCLONE_WEBDAV_PASS).toBe('OBSCURED');
  });

  it('lists files recursively, without hidden files, and maps the answer', async () => {
    const json = JSON.stringify([
      {
        Path: 'a.md',
        Name: 'a.md',
        Size: 12,
        ModTime: '2026-11-04T10:00:00Z',
        IsDir: false,
      },
      {
        Path: 'sub/b.md',
        Name: 'b.md',
        Size: 3,
        ModTime: '2026-11-04T10:01:00.123456789Z',
        IsDir: false,
      },
    ]);
    const { calls, exec } = recorder({ obscure: 'O', lsjson: json });
    const files = await createRcloneRemote(config, exec).list();
    expect(files).toEqual([
      { path: 'a.md', size: 12, modTime: '2026-11-04T10:00:00Z' },
      { path: 'sub/b.md', size: 3, modTime: '2026-11-04T10:01:00.123456789Z' },
    ]);
    const args = calls.find((c) => c.args[0] === 'lsjson')?.args ?? [];
    expect(args).toContain('-R');
    expect(args).toContain('--files-only');
    expect(args).toContain(':webdav:');
    for (const pattern of EXCLUDES) {
      expect(args.join(' ')).toContain(`--exclude ${pattern}`);
    }
  });

  it('copies the share into the folder with the same filters', async () => {
    const { calls, exec } = recorder({ obscure: 'O' });
    await createRcloneRemote(config, exec).download('/tmp/dest');
    const args = calls.find((c) => c.args[0] === 'copy')?.args ?? [];
    expect(args.slice(0, 3)).toEqual(['copy', ':webdav:', '/tmp/dest']);
    expect(args.join(' ')).toContain('--exclude .*');
  });

  it('refuses an answer that is not a list', async () => {
    const { exec } = recorder({ obscure: 'O', lsjson: '{"error":1}' });
    await expect(createRcloneRemote(config, exec).list()).rejects.toThrow(
      /unexpected/i,
    );
  });

  it('refuses entries with missing fields', async () => {
    const { exec } = recorder({ obscure: 'O', lsjson: '[{"Path":"a.md"}]' });
    await expect(createRcloneRemote(config, exec).list()).rejects.toThrow(
      /unexpected/i,
    );
  });

  it('passes errors on', async () => {
    const exec: Exec = async () => {
      throw new Error('rclone lsjson exited with 1');
    };
    await expect(createRcloneRemote(config, exec).list()).rejects.toThrow(
      'exited with 1',
    );
  });
});

describe('parseListing', () => {
  it('refuses an answer that is not JSON, not a list, or has broken entries', async () => {
    const { parseListing } = await import('./rclone.ts');
    expect(() => parseListing('nonsense')).toThrow(/not JSON/);
    expect(() => parseListing('{}')).toThrow(/not a list/);
    expect(() => parseListing('[{"Path": 1}]')).toThrow(/Unexpected entry/);
  });

  it('obscures the password only once for several calls', async () => {
    const { calls, exec } = recorder({ obscure: 'X\n', lsjson: '[]' });
    const remote = createRcloneRemote(config, exec);
    await remote.list();
    await remote.download('/tmp/x');
    expect(calls.filter((c) => c.args[0] === 'obscure')).toHaveLength(1);
    expect(calls.at(-1)?.args.slice(0, 3)).toEqual([
      'copy',
      ':webdav:',
      '/tmp/x',
    ]);
  });
});
