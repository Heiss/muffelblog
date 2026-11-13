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
      )
      // Matomo is optional; the examples show the policy without it.
      .replaceAll(' {$MATOMO_URL}', '');
    expect(csp).toBeTruthy();
    const page = await read(
      'apps',
      'docs',
      'src',
      'content',
      'docs',
      'production',
      'host-folder.md',
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
      'host-folder.md',
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

  it('lists every documentation page in the site map, rendered and as raw Markdown, and agent.md links to it', async () => {
    const map = await read(
      'apps',
      'docs',
      'src',
      'content',
      'docs',
      'reference',
      'site-map.md',
    );
    const pages = (await docFiles())
      .map((f) => path.relative(docsDir, f).replace(/\.mdx?$/, ''))
      // The start page and the map itself need no row.
      .filter((slug) => slug !== 'index' && slug !== 'reference/site-map');
    expect(pages.length).toBeGreaterThan(10);
    for (const slug of pages) {
      expect(map, `rendered link to ${slug}`).toContain(
        `](/muffelblog/${slug}/)`,
      );
      expect(map, `raw link to ${slug}`).toMatch(
        new RegExp(
          `\\]\\(https://raw\\.githubusercontent\\.com/Heiss/muffelblog/main/apps/docs/src/content/docs/${slug}\\.md\\)`,
        ),
      );
    }
    const agent = await read('apps', 'docs', 'public', 'agent.md');
    expect(agent).toContain(
      'https://heiss.github.io/muffelblog/reference/site-map/',
    );
  });

  it('tells every proxy to revalidate /health.json and /entries.json like /build.json, as the Caddyfile does', async () => {
    const caddyfile = await read('docker', 'Caddyfile');
    expect(caddyfile).toMatch(
      /@buildjson path \/build\.json \/health\.json \/entries\.json/,
    );
    const page = await read(
      'apps',
      'docs',
      'src',
      'content',
      'docs',
      'production',
      'host-folder.md',
    );
    expect(page).toMatch(
      /@buildjson path \/build\.json \/health\.json \/entries\.json/,
    ); // Caddy
    expect(page).toContain('location ~ ^/(build|health|entries)\\.json$'); // nginx
  });

  it('names Compose files that exist', async () => {
    for (const name of [
      'compose.yaml',
      'compose.demo.yaml',
      'compose.host-folder.yaml',
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
    for (const name of pages.match(/compose(\.[a-z-]+)?\.yaml/g) ?? []) {
      await expect(
        readFile(path.join(root, name), 'utf8'),
        name,
      ).resolves.toBeTruthy();
    }
  });

  it('lists the supported versions of supported-versions.json, which CI tests', async () => {
    const versions = JSON.parse(
      await read('supported-versions.json'),
    ) as Record<string, { current: string; previous: string }>;
    const page = await read(
      'apps',
      'docs',
      'src',
      'content',
      'docs',
      'reference',
      'versions.md',
    );
    const ci = await read('.github', 'workflows', 'ci.yml');
    for (const [name, line] of Object.entries(versions)) {
      if (name.startsWith('$')) continue;
      expect(page, `${name} current`).toContain(`\`${line.current}\``);
      expect(page, `${name} previous`).toContain(`\`${line.previous}\``);
      expect(ci, name).toContain(
        `fromJSON(needs.versions.outputs.json).${name}[matrix.line]`,
      );
    }
    expect(ci).toMatch(/line: \[current, previous\]/);
  });

  describe('getting started', () => {
    const page = () =>
      read(
        'apps',
        'docs',
        'src',
        'content',
        'docs',
        'start',
        'getting-started.md',
      );
    const required = async () => {
      const compose = await read('compose.yaml');
      return new Set(
        [...compose.matchAll(/\$\{([A-Z_]+):\?/g)].map((m) => m[1] as string),
      );
    };

    it('is the first step after the introduction in the sidebar', async () => {
      const config = await read('apps', 'docs', 'astro.config.mjs');
      expect(config.indexOf("slug: 'start/getting-started'")).toBeLessThan(
        config.indexOf("slug: 'start/quickstart'"),
      );
    });

    it('explains every variable that compose.yaml requires, and the sources', async () => {
      const text = await page();
      const names = await required();
      expect(names.size).toBeGreaterThan(6);
      for (const name of [...names, 'NEXTCLOUD_URL', 'MEMOS_URL'])
        expect(text, name).toContain(`\`${name}\``);
    });

    it('lists the same required variables in the configuration reference', async () => {
      const config = await read(
        'apps',
        'docs',
        'src',
        'content',
        'docs',
        'reference',
        'configuration.md',
      );
      const section = config.slice(
        config.indexOf('## Required'),
        config.indexOf('\n## ', config.indexOf('## Required') + 1),
      );
      for (const name of await required())
        expect(section, name).toContain(`\`${name}\``);
    });

    it('forwards to the ports that compose.yaml publishes', async () => {
      const text = await page();
      const compose = await read('compose.yaml');
      expect(compose).toContain('${MUFFEL_PORT:-8080}:80');
      expect(compose).toContain('${MUFFEL_COMMENTS_PORT:-8081}:8081');
      expect(text).toContain('127.0.0.1:8080');
      expect(text).toContain('127.0.0.1:8081');
    });

    it('only names files of the example folder that exist (Nextcloud guide)', async () => {
      const guide = await read(
        'apps',
        'docs',
        'src',
        'content',
        'docs',
        'guides',
        'nextcloud.md',
      );
      expect(guide).toContain('examples/nextcloud-folder');
      await stat(
        path.join(root, 'examples', 'nextcloud-folder', 'hello-world.md'),
      );
    });
  });

  it('only names scripts of the repository that exist and are executable', async () => {
    const text = (
      await Promise.all((await docFiles()).map((f) => readFile(f, 'utf8')))
    ).join('\n');
    const names = new Set(text.match(/docker\/[a-z-]+\.(?:sh|mjs)/g) ?? []);
    expect(names.size).toBeGreaterThan(3);
    for (const name of names) {
      const info = await stat(path.join(root, name));
      expect(info.isFile(), name).toBe(true);
      if (name.endsWith('.sh')) {
        expect(info.mode & 0o111, `${name} is executable`).not.toBe(0);
      }
    }
  });

  it('only sets variables in examples that the project knows', async () => {
    const text = (
      await Promise.all((await docFiles()).map((f) => readFile(f, 'utf8')))
    ).join('\n');
    const known = [
      await read('.env.example'),
      await read('compose.yaml'),
      await read('compose.host-folder.yaml'),
      await read('compose.demo.yaml'),
      SETTING_SPECS.map((s) => s.env).join('\n'),
      'MUFFEL_WEBMENTIONS_SEND COMPOSE_FILE',
    ].join('\n');
    const set = new Set(
      [...text.matchAll(/^([A-Z][A-Z0-9_]{3,})=/gm)].map((m) => m[1] as string),
    );
    expect(set.size).toBeGreaterThan(5);
    for (const name of set) expect(known, name).toContain(name);
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
      for (const name of text.match(/compose(?:\.[a-z-]+)?\.yaml/g) ?? []) {
        await stat(path.join(root, name));
      }
      const known = [
        await read('.env.example'),
        await read('compose.yaml'),
        await read('compose.host-folder.yaml'),
        await read('compose.demo.yaml'),
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
