import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildHealth, writeHealth } from './health.ts';
import type { Status } from './scheduler.ts';

const NOW = new Date('2026-11-04T12:05:00.000Z');

describe('buildHealth', () => {
  it('shows state, the last check, the last success and the interval', () => {
    const status: Status = {
      state: 'ok',
      lastCheck: '2026-11-04T12:04:00.000Z',
      lastSuccess: { id: '20261104T120000Z', at: '2026-11-04T12:00:10.000Z' },
    };
    expect(buildHealth(status, 180, NOW)).toEqual({
      state: 'ok',
      generatedAt: '2026-11-04T12:05:00.000Z',
      lastCheck: '2026-11-04T12:04:00.000Z',
      lastSuccess: { id: '20261104T120000Z', at: '2026-11-04T12:00:10.000Z' },
      checkIntervalSeconds: 180,
    });
  });

  it('says since when it fails, and never shows the error text', () => {
    const status: Status = {
      state: 'failing',
      lastCheck: '2026-11-04T12:04:00.000Z',
      lastSuccess: { id: 'r1', at: '2026-11-04T09:00:00.000Z' },
      lastError: {
        message: 'rclone: https://cloud.internal.example/s/TOKEN failed',
        at: '2026-11-04T12:04:00.000Z',
        since: '2026-11-04T10:00:00.000Z',
      },
      webmentions: {
        lastRun: 'x',
        sent: 1,
        failed: 0,
        givenUp: 0,
        noEndpoint: 0,
      },
    };
    const health = buildHealth(status, 60, NOW);
    expect(health.state).toBe('failing');
    expect(health.failingSince).toBe('2026-11-04T10:00:00.000Z');
    const text = JSON.stringify(health);
    expect(text).not.toContain('cloud.internal');
    expect(text).not.toContain('TOKEN');
    expect(text).not.toContain('webmentions');
    expect(text).not.toContain('message');
  });

  it('leaves out lastSuccess before the first build', () => {
    const health = buildHealth(
      { state: 'failing', lastCheck: '2026-11-04T12:04:00.000Z' },
      180,
      NOW,
    );
    expect('lastSuccess' in health).toBe(false);
  });
});

describe('writeHealth', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'health-'));
    await mkdir(path.join(root, 'r1'));
    await symlink('r1', path.join(root, 'current'));
  });
  afterEach(() => rm(root, { recursive: true, force: true }));

  const status: Status = { state: 'ok', lastCheck: '2026-11-04T12:04:00.000Z' };

  it('writes health.json into the release that current points at', async () => {
    await writeHealth(root, status, 180, NOW);
    const text = await readFile(path.join(root, 'r1', 'health.json'), 'utf8');
    expect(JSON.parse(text)).toMatchObject({
      state: 'ok',
      checkIntervalSeconds: 180,
    });
    expect(text.endsWith('\n')).toBe(true);
  });

  it('replaces the file at every check and leaves no temporary file', async () => {
    await writeHealth(root, status, 180, NOW);
    await writeHealth(
      root,
      { ...status, lastCheck: '2026-11-04T12:07:00.000Z' },
      180,
      new Date('2026-11-04T12:07:30.000Z'),
    );
    const health = JSON.parse(
      await readFile(path.join(root, 'r1', 'health.json'), 'utf8'),
    );
    expect(health.lastCheck).toBe('2026-11-04T12:07:00.000Z');
    expect(await readdir(path.join(root, 'r1'))).toEqual(['health.json']);
  });

  it('does nothing while no release is online', async () => {
    await rm(path.join(root, 'current'));
    await expect(writeHealth(root, status, 180, NOW)).resolves.toBeUndefined();
    expect(await readdir(root)).toEqual(['r1']);
  });

  it('does nothing when the releases folder does not exist yet', async () => {
    await expect(
      writeHealth(path.join(root, 'missing'), status, 180, NOW),
    ).resolves.toBeUndefined();
  });
});
