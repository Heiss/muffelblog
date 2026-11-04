import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALLOWED_IMAGE_HOSTS, EMBED_RULES } from './policy.ts';

const caddyfile = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'docker',
  'Caddyfile',
);

async function policy(): Promise<Map<string, string[]>> {
  const text = await readFile(caddyfile, 'utf8');
  const line = text.match(/Content-Security-Policy "([^"]+)"/);
  if (!line?.[1]) throw new Error('Content-Security-Policy not found');
  const map = new Map<string, string[]>();
  for (const part of line[1].split(';')) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) map.set(name, values);
  }
  return map;
}

describe('Content Security Policy of the Caddyfile', () => {
  it('lets images load from exactly the allowed image hosts', async () => {
    const img = (await policy()).get('img-src') ?? [];
    const hosts = img.filter((v) => v.startsWith('https://'));
    expect(hosts.sort()).toEqual(
      ALLOWED_IMAGE_HOSTS.map((h) => `https://${h}`).sort(),
    );
  });

  // The origin of the comments server comes from the environment.
  const COMMENTS = '{$COMMENTS_URL:http://localhost:8081}';

  it('lets frames load from exactly the embed hosts and the comments server', async () => {
    const frame = (await policy()).get('frame-src') ?? [];
    expect(frame.sort()).toEqual(
      [
        ...new Set(EMBED_RULES.map((r) => `https://${r.host}`)),
        COMMENTS,
      ].sort(),
    );
  });

  it('allows scripts only from the own host, the comments server and WebAssembly (search)', async () => {
    const script = (await policy()).get('script-src') ?? [];
    expect(script.sort()).toEqual(
      ["'self'", "'wasm-unsafe-eval'", COMMENTS].sort(),
    );
  });

  it('has no unsafe-inline and starts from nothing', async () => {
    const p = await policy();
    expect(p.get('default-src')).toEqual(["'none'"]);
    for (const [name, values] of p) {
      expect(values, name).not.toContain("'unsafe-inline'");
      expect(values, name).not.toContain("'unsafe-eval'");
    }
  });
});

describe('Caddyfile and client addresses', () => {
  it('overwrites X-Real-IP for Remark42, so a visitor cannot choose their address', async () => {
    const text = await readFile(caddyfile, 'utf8');
    expect(text).toMatch(/header_up X-Real-IP \{client_ip\}/);
    expect(text).toMatch(/header_up -Authorization/);
  });
});
