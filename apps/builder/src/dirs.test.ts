import { describe, expect, it } from 'vitest';
import { assertWritable } from './dirs.ts';

describe('assertWritable', () => {
  const ok = async () => {};

  it('passes when every folder can be written', async () => {
    await expect(
      assertWritable(
        { releases: '/data/releases', state: '/data/state' },
        { ensure: ok, access: ok, uid: 1000, gid: 1000 },
      ),
    ).resolves.toBeUndefined();
  });

  it('says which folder, for which user, and how to repair a volume or a host folder', async () => {
    const denied = async (dir: string) => {
      if (dir === '/data/state') {
        throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
      }
    };
    const error = await assertWritable(
      { releases: '/data/releases', state: '/data/state' },
      { ensure: ok, access: denied, uid: 1000, gid: 1000 },
    ).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    const text = String(error);
    expect(text).toContain('/data/state');
    expect(text).toContain('uid 1000');
    expect(text).toContain('chown -R 1000:1000');
    expect(text).toContain('--user root');
    expect(text).not.toContain('/data/releases is not');
  });

  it('names every folder that is not writable', async () => {
    const denied = async () => {
      throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
    };
    const text = String(
      await assertWritable(
        { releases: '/a', cache: '/b' },
        { ensure: ok, access: denied, uid: 5, gid: 6 },
      ).catch((e: Error) => e),
    );
    expect(text).toContain('/a');
    expect(text).toContain('/b');
    expect(text).toContain('chown -R 5:6');
  });

  it('creates a missing folder first and does not mind if that is not possible', async () => {
    const made: string[] = [];
    await assertWritable(
      { state: '/data/state' },
      {
        ensure: async (d) => {
          made.push(d);
          throw new Error('cannot make');
        },
        access: ok,
        uid: 1,
        gid: 1,
      },
    );
    expect(made).toEqual(['/data/state']);
  });
});
