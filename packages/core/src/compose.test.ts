import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

// Compose cannot run in the unit tests, but its wiring can be checked: a
// `depends_on` with `service_healthy` needs a healthcheck on that service
// (CI found this once, because the edit had not been applied).
const file = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'compose.yaml',
);

interface Service {
  healthcheck?: unknown;
  profiles?: string[];
  ports?: string[];
  volumes?: string[];
  environment?: Record<string, string>;
  restart?: string;
  depends_on?: Record<string, { condition?: string }>;
}

async function services(
  name = 'compose.yaml',
): Promise<Record<string, Service>> {
  const doc = parse(
    await readFile(path.join(path.dirname(file), name), 'utf8'),
    {
      logLevel: 'silent', // the override file uses the Compose tag `!override`
    },
  ) as { services: Record<string, Service> };
  return doc.services;
}

describe('compose.yaml', () => {
  it('has a healthcheck for every service that others wait for to be healthy', async () => {
    const all = await services();
    for (const [name, service] of Object.entries(all)) {
      for (const [dep, rule] of Object.entries(service.depends_on ?? {})) {
        if (rule.condition === 'service_healthy') {
          expect(
            all[dep]?.healthcheck,
            `${name} waits for ${dep}`,
          ).toBeDefined();
        }
        if (rule.condition === 'service_completed_successfully') {
          expect(all[dep]?.restart, `${dep} must not restart`).toMatch(
            /^"?no"?$/,
          );
        }
      }
    }
  });

  it('keeps the builder running, because it is the scheduler', async () => {
    expect((await services()).builder?.restart).toBe('unless-stopped');
  });

  it('starts the web server only after the first release is online', async () => {
    expect((await services()).web?.depends_on?.builder?.condition).toBe(
      'service_healthy',
    );
  });
});

describe('compose.yaml ports', () => {
  it('publishes only our web server, and only on this machine by default', async () => {
    const all = await services();
    const published = Object.entries(all).filter(([, s]) => s.ports?.length);
    expect(published.map(([n]) => n)).toEqual(['web']);
    for (const port of all.web?.ports ?? [])
      expect(port).toMatch(/^\$\{MUFFEL_BIND:-127\.0\.0\.1\}:/);
  });
});

describe('compose.yaml is the production setup', () => {
  it('requires the public addresses and the mail server, so a mistake shows at once', async () => {
    const { builder, remark42 } = await services();
    expect(builder?.environment?.SITE_URL).toMatch(/:\?/);
    expect(builder?.environment?.COMMENTS_URL).toMatch(/:\?/);
    for (const name of [
      'SMTP_HOST',
      'SMTP_PORT',
      'NOTIFY_EMAIL_FROM',
      'ADMIN_SHARED_EMAIL',
    ]) {
      expect(remark42?.environment?.[name], name).toMatch(/:\?/);
    }
  });

  it('has no demo content and no mail sink', async () => {
    const all = await services();
    expect(all.mailpit).toBeUndefined();
    expect(all.builder?.environment?.MUFFEL_FIXTURES).toBe(
      '${MUFFEL_FIXTURES:-}',
    );
    expect(JSON.stringify(all)).not.toContain('localhost');
  });

  it('gives our web server the comments origin for its Content Security Policy', async () => {
    const { web } = await services();
    expect(web?.environment?.COMMENTS_URL).toBe('${COMMENTS_URL}');
    expect(web?.environment?.MUFFEL_TRUSTED_PROXIES).toMatch(/private_ranges/);
  });
});

describe('compose.demo.yaml (local demo)', () => {
  it('adds the mail sink, published on this machine only', async () => {
    const { mailpit } = await services('compose.demo.yaml');
    expect(mailpit?.ports?.length).toBeGreaterThan(0);
    for (const port of mailpit?.ports ?? [])
      expect(port).toMatch(/^'?127\.0\.0\.1:/);
  });

  it('is chosen by init-env.sh --demo together with the local addresses', async () => {
    const script = await readFile(
      path.join(path.dirname(file), 'docker', 'init-env.sh'),
      'utf8',
    );
    expect(script).toContain('COMPOSE_FILE=compose.yaml:compose.demo.yaml');
    for (const name of [
      'SITE_URL',
      'COMMENTS_URL',
      'MAIL_FROM',
      'REMARK_ADMIN_EMAIL',
      'SMTP_HOST',
      'SMTP_PORT',
    ]) {
      expect(script, name).toContain(`s|^${name}=.*|${name}=`);
    }
  });

  it('every variable that init-env.sh fills in is a line of .env.example', async () => {
    const example = await readFile(
      path.join(path.dirname(file), '.env.example'),
      'utf8',
    );
    for (const name of [
      'REMARK_SECRET',
      'REMARK_ADMIN_PASSWD',
      'SITE_URL',
      'COMMENTS_URL',
      'MAIL_FROM',
      'REMARK_ADMIN_EMAIL',
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_TLS',
    ]) {
      expect(example, name).toMatch(new RegExp(`^${name}=`, 'm'));
    }
  });
});

describe('compose.host-folder.yaml (your proxy serves the files)', () => {
  it('shares the releases with the host and requires the folder', async () => {
    const { builder } = await services('compose.host-folder.yaml');
    const mount = (builder?.volumes ?? []).find((v) =>
      v.endsWith(':/data/releases'),
    );
    expect(mount).toMatch(/^\$\{MUFFEL_RELEASES_DIR:\?/);
  });

  it('does not start our web server', async () => {
    const { web } = await services('compose.host-folder.yaml');
    expect(web?.profiles?.length).toBeGreaterThan(0);
  });

  it('opens Remark42 for the host only, never to the network', async () => {
    const { remark42 } = await services('compose.host-folder.yaml');
    expect(remark42?.ports?.length).toBeGreaterThan(0);
    for (const port of remark42?.ports ?? [])
      expect(port).toMatch(/^127\.0\.0\.1:/);
  });
});

describe('Remark42 hardening and moderation', () => {
  it('trusts forwarding headers only from the proxy network (rate limit cannot be bypassed)', async () => {
    const { remark42 } = await services();
    expect(remark42?.environment?.TRUSTED_PROXY).toMatch(
      /TRUSTED_PROXY:-172\.16\.0\.0\/12/,
    );
  });

  it('grants UI privileges by user ID and sends notifications to the admin email', async () => {
    const { remark42 } = await services();
    expect(remark42?.environment?.ADMIN_SHARED_EMAIL).toMatch(
      /REMARK_ADMIN_EMAIL/,
    );
    expect(remark42?.environment?.ADMIN_SHARED_ID).toMatch(/REMARK_ADMIN_ID/);
    expect(remark42?.environment?.NOTIFY_ADMINS).toBe('email');
    expect(remark42?.environment?.NOTIFY_EMAIL_FROM).toMatch(/MAIL_FROM/);
  });

  it('requires the administrator email, where a guessable default would be a risk', async () => {
    const { remark42 } = await services();
    expect(remark42?.environment?.ADMIN_SHARED_EMAIL).toMatch(/:\?/);
  });

  describe('the Dockerfile', () => {
    const dockerfile = () =>
      readFile(path.join(path.dirname(file), 'Dockerfile'), 'utf8');

    it('runs the builder as the user node and hands the data folders to it', async () => {
      const text = await dockerfile();
      const builder = text.slice(text.indexOf('AS builder'));
      expect(builder).toMatch(/^USER node$/m);
      expect(builder).toMatch(/chown -R node:node \/data/);
      expect(builder).toMatch(
        /mkdir -p \/data\/releases \/data\/cache \/data\/state/,
      );
      // the user is set after the folders are made, and before the command
      expect(builder.indexOf('USER node')).toBeGreaterThan(
        builder.indexOf('chown -R node:node'),
      );
      expect(builder.indexOf('USER node')).toBeLessThan(builder.indexOf('CMD'));
    });

    it('installs the HEIC converter as root, before the user is set', async () => {
      const text = await dockerfile();
      const builder = text.slice(text.indexOf('AS builder'));
      const install = builder.indexOf('libheif-examples');
      expect(install).toBeGreaterThan(-1);
      expect(install).toBeLessThan(builder.indexOf('USER node'));
      expect(builder).toMatch(/rm -rf \/var\/lib\/apt\/lists/);
    });

    it('takes the image variant as a build argument into the environment', async () => {
      const text = await dockerfile();
      const builder = text.slice(text.indexOf('AS builder'));
      expect(builder).toMatch(/^ARG VARIANT=$/m);
      expect(builder).toMatch(/MUFFEL_IMAGE_VARIANT=\$VARIANT/);
    });

    it('installs the system certificates, so rclone can check HTTPS', async () => {
      const text = await dockerfile();
      const builder = text.slice(text.indexOf('AS builder'));
      expect(builder).toMatch(/apt-get install[^\n]*\bca-certificates\b/);
    });

    it('has no pnpm at run time and starts node directly', async () => {
      const text = await dockerfile();
      const builder = text.slice(text.indexOf('AS builder'));
      expect(builder).toMatch(/npm uninstall --global pnpm/);
      expect(builder).toMatch(/^CMD \["node", "src\/cli\.ts"\]$/m);
      expect(builder.indexOf('npm uninstall')).toBeLessThan(
        builder.indexOf('USER node'),
      );
    });

    it('does not set a user in the stages that only build', async () => {
      const text = await dockerfile();
      const before = text.slice(0, text.indexOf('AS builder'));
      expect(before).not.toMatch(/^USER /m);
    });
  });
});
