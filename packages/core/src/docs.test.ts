import { readFile, readdir, stat } from 'node:fs/promises';
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

  it('tells every proxy to set X-Real-IP itself for the comments host', async () => {
    const page = await read(
      'apps',
      'docs',
      'src',
      'content',
      'docs',
      'production',
      'own-proxy.md',
    );
    expect(page).toMatch(/header_up X-Real-IP \{client_ip\}/); // Caddy
    expect(page).toMatch(/proxy_set_header X-Real-IP \$remote_addr;/); // nginx
    expect(page).toContain('TRUSTED_PROXY');
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
      'REMARK_ADMIN_EMAIL',
      'TRUSTED_PROXY',
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
    // Files of the folder `public/` are served as they are (agent.md).
    for (const name of await readdir(
      path.join(docsDir, '..', '..', '..', 'public'),
    )) {
      slugs.add(name);
    }
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

  describe('the tutorial', () => {
    const tutorial = async () =>
      (
        await Promise.all(
          (await docFiles())
            .filter((f) => f.includes(`${path.sep}tutorial${path.sep}`))
            .map((f) => readFile(f, 'utf8')),
        )
      ).join('\n');

    it('has the four chapters in the sidebar', async () => {
      const config = await read('apps', 'docs', 'astro.config.mjs');
      for (const slug of [
        'tutorial/1-prepare',
        'tutorial/2-publish',
        'tutorial/3-comments',
        'tutorial/4-webmentions',
      ]) {
        expect(config, slug).toContain(`slug: '${slug}'`);
      }
    });

    it('only names scripts of the repository that exist and are executable', async () => {
      const names = new Set(
        (await tutorial()).match(/docker\/[a-z-]+\.(?:sh|mjs)/g) ?? [],
      );
      expect(names.size).toBeGreaterThan(3);
      for (const name of names) {
        const info = await stat(path.join(root, name));
        expect(info.isFile(), name).toBe(true);
        if (name.endsWith('.sh')) {
          expect(info.mode & 0o111, `${name} is executable`).not.toBe(0);
        }
      }
    });

    it('only names files of the example folder that exist', async () => {
      const text = await tutorial();
      for (const name of [
        'hello-world.md',
        'pages/legal.md',
        'pages/privacy.md',
        'README.md',
      ]) {
        expect(text, name).toContain(name.split('/').pop() as string);
        await stat(path.join(root, 'examples', 'nextcloud-folder', name));
      }
    });

    it('only sets variables that the project knows', async () => {
      const text = await tutorial();
      const known = [
        await read('.env.example'),
        await read('compose.yaml'),
        await read('compose.production.yaml'),
        SETTING_SPECS.map((s) => s.env).join('\n'),
      ].join('\n');
      const set = new Set(
        [...text.matchAll(/^([A-Z][A-Z0-9_]{3,})=/gm)].map((m) => m[1]),
      );
      expect(set.size).toBeGreaterThan(10);
      for (const name of set) {
        // the switch of sending is a flag, not a numeric setting
        if (name === 'MUFFEL_WEBMENTIONS_SEND') {
          expect(known, name).toContain('MUFFEL_WEBMENTIONS_SEND');
          continue;
        }
        expect(known, name).toContain(name);
      }
    });
  });

  describe('the guide for AI agents (agent.md)', () => {
    const agent = () => read('apps', 'docs', 'public', 'agent.md');

    it('only lists pages that exist', async () => {
      const text = await agent();
      const table = text.slice(text.indexOf('## Pages to fetch'));
      const paths = [...table.matchAll(/^\| `([a-z0-9/-]+)`/gm)].map(
        (m) => m[1],
      );
      expect(paths.length).toBeGreaterThanOrEqual(8);
      for (const p of paths) {
        await expect(
          stat(path.join(docsDir, `${p}.md`)),
          p,
        ).resolves.toBeTruthy();
      }
    });

    it('only names scripts, Compose files and variables that exist', async () => {
      const text = await agent();
      for (const name of text.match(/docker\/[a-z-]+\.(?:sh|mjs)/g) ?? []) {
        await stat(path.join(root, name));
      }
      for (const name of text.match(/compose(?:\.[a-z]+)?\.yaml/g) ?? []) {
        await stat(path.join(root, name));
      }
      const known = [
        await read('.env.example'),
        await read('compose.yaml'),
        await read('compose.production.yaml'),
        await read('compose.domain.yaml'),
        SETTING_SPECS.map((s) => s.env).join('\n'),
        'MUFFEL_WEBMENTIONS_SEND MUFFEL_LANG MUFFEL_FIXTURES',
      ].join('\n');
      const names = new Set(text.match(/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/g) ?? []);
      expect(names.size).toBeGreaterThan(10);
      for (const name of names) expect(known, name).toContain(name);
    });

    it('keeps the rules about secrets and about asking first', async () => {
      const text = await agent();
      expect(text).toMatch(/Never ask for,\s+read or print a password/);
      expect(text).toContain('NEXTCLOUD_SHARE_PASSWORD');
      expect(text).toContain('SMTP_PASSWORD');
      expect(text).toMatch(/explicit "yes"/);
      expect(text).toContain('MUFFEL_WEBMENTIONS_SEND');
      expect(text).toMatch(/\*\*off\*\* by default/);
    });

    it('is linked from the prompt page, which carries the address of agent.md', async () => {
      const page = await read(
        'apps',
        'docs',
        'src',
        'content',
        'docs',
        'start',
        'agent-install.md',
      );
      expect(page).toContain('https://heiss.github.io/muffelblog/agent.md');
      const config = await read('apps', 'docs', 'astro.config.mjs');
      expect(config).toContain("slug: 'start/agent-install'");
    });
  });
});
