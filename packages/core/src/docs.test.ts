import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SETTING_SPECS } from './config.ts';

// The documentation site (apps/docs) must not drift from the code: the Content
// Security Policy it tells people to send, the list of settings and its links.
const root = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);
const docsDir = path.join(root, 'apps', 'docs', 'src', 'content', 'docs');

async function docFiles(dir = docsDir): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await docFiles(full)));
    else if (/\.mdx?$/.test(e.name)) out.push(full);
  }
  return out;
}

const read = (...p: string[]) => readFile(path.join(root, ...p), 'utf8');

describe('documentation matches the code', () => {
  it('shows the Content Security Policy of the Caddyfile in every proxy example', async () => {
    const caddyfile = await read('docker', 'Caddyfile');
    const csp = caddyfile
      .match(/Content-Security-Policy "([^"]+)"/)?.[1]
      ?.replaceAll(
        '{$COMMENTS_URL:http://localhost:8081}',
        'https://comments.example.org',
      );
    expect(csp).toBeTruthy();
    const page = await read(
      'apps',
      'docs',
      'src',
      'content',
      'docs',
      'production',
      'own-proxy.md',
    );
    // plain block, Caddy, nginx
    expect(page.split(csp as string).length - 1).toBeGreaterThanOrEqual(3);
  });

  it('lists every setting of the code in the configuration reference', async () => {
    const page = await read(
      'apps',
      'docs',
      'src',
      'content',
      'docs',
      'reference',
      'configuration.md',
    );
    for (const spec of SETTING_SPECS) {
      expect(page, spec.env).toContain(`\`${spec.env}\``);
      expect(page, `${spec.env} default`).toContain(String(spec.default));
    }
    for (const name of [
      'NEXTCLOUD_URL',
      'NEXTCLOUD_SHARE_TOKEN',
      'NEXTCLOUD_SHARE_PASSWORD',
      'NEXTCLOUD_SHARE_PASSWORD_FILE',
      'MEMOS_URL',
      'SITE_URL',
      'COMMENTS_URL',
      'COMMENTS_SITE_ID',
      'REMARK_INTERNAL_URL',
      'MUFFEL_FIXTURES',
      'MUFFEL_ALERT_WEBHOOK',
      'MUFFEL_ALERT_FORMAT',
      'MUFFEL_RELEASES_DIR',
      'REMARK_PORT',
    ]) {
      expect(page, name).toContain(`\`${name}\``);
    }
  });

  it('only links to pages that exist', async () => {
    const files = await docFiles();
    const slugs = new Set(
      files.map((f) =>
        path
          .relative(docsDir, f)
          .replace(/\.mdx?$/, '')
          .replace(/(^|\/)index$/, ''),
      ),
    );
    for (const file of files) {
      const text = await readFile(file, 'utf8');
      const targets = Array.from(
        text.matchAll(
          /\]\(\/muffelblog\/([^)#]*)(?:#[^)]*)?\)|link: \/muffelblog\/(\S*)/g,
        ),
        (m) => m[1] ?? m[2] ?? '',
      );
      for (const target of targets) {
        const slug = target.replace(/\/$/, '');
        expect(
          slugs.has(slug),
          `${path.relative(root, file)} links to /muffelblog/${slug}/`,
        ).toBe(true);
      }
    }
  });

  it('names Compose files that exist', async () => {
    for (const name of [
      'compose.yaml',
      'compose.production.yaml',
      'compose.domain.yaml',
      'docker/init-env.sh',
    ]) {
      await expect(
        readFile(path.join(root, name), 'utf8'),
        name,
      ).resolves.toBeTruthy();
    }
    const pages = (
      await Promise.all((await docFiles()).map((f) => readFile(f, 'utf8')))
    ).join('\n');
    for (const name of pages.match(/compose(\.[a-z]+)?\.yaml/g) ?? []) {
      await expect(
        readFile(path.join(root, name), 'utf8'),
        name,
      ).resolves.toBeTruthy();
    }
  });
});
