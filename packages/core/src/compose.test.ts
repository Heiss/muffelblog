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
  it('publishes only the web server and the mail UI, and the mail UI only on this machine', async () => {
    const all = await services();
    const published = Object.entries(all).filter(([, s]) => s.ports?.length);
    expect(published.map(([n]) => n).sort()).toEqual(['mailpit', 'web']);
    for (const port of all.mailpit?.ports ?? [])
      expect(port).toMatch(/^127\.0\.0\.1:/);
  });
});

describe('compose.production.yaml (own reverse proxy)', () => {
  it('shares the releases with the host and requires the folder', async () => {
    const { builder } = await services('compose.production.yaml');
    const mount = (builder?.volumes ?? []).find((v) =>
      v.endsWith(':/data/releases'),
    );
    expect(mount).toMatch(/^\$\{MUFFEL_RELEASES_DIR:\?/);
  });

  it('serves the same host folder when our web server is switched on', async () => {
    const { web } = await services('compose.production.yaml');
    const mount = (web?.volumes ?? []).find((v) =>
      v.endsWith(':/srv/releases:ro'),
    );
    expect(mount).toMatch(/^\$\{MUFFEL_RELEASES_DIR:\?/);
  });

  it('does not start our web server or the mail sink by default', async () => {
    const all = await services('compose.production.yaml');
    expect(all.web?.profiles?.length).toBeGreaterThan(0);
    expect(all.mailpit?.profiles?.length).toBeGreaterThan(0);
  });

  it('opens Remark42 for the host only, never to the network', async () => {
    const { remark42 } = await services('compose.production.yaml');
    expect(remark42?.ports?.length).toBeGreaterThan(0);
    for (const port of remark42?.ports ?? [])
      expect(port).toMatch(/^127\.0\.0\.1:/);
  });

  it('requires a real mail server, because there is no mail sink', async () => {
    const { remark42 } = await services('compose.production.yaml');
    for (const name of [
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USERNAME',
      'SMTP_PASSWORD',
      'AUTH_EMAIL_FROM',
    ]) {
      expect(remark42?.environment?.[name], name).toMatch(/:\?/);
    }
  });
});

describe('compose.domain.yaml (our Caddy with a domain)', () => {
  it('requires both host names and publishes 80 and 443 instead of the local ports', async () => {
    const { web } = await services('compose.domain.yaml');
    expect(web?.environment?.SITE_ADDRESS).toMatch(/:\?/);
    expect(web?.environment?.COMMENTS_ADDRESS).toMatch(/:\?/);
    expect(web?.ports).toEqual(['80:80', '443:443', '443:443/udp']);
  });
});

describe('Remark42 hardening and moderation', () => {
  it('trusts forwarding headers only from the proxy network (rate limit cannot be bypassed)', async () => {
    const { remark42 } = await services();
    expect(remark42?.environment?.TRUSTED_PROXY).toMatch(
      /TRUSTED_PROXY:-172\.16\.0\.0\/12/,
    );
  });

  it('names an administrator by email and notifies admins about new comments by email', async () => {
    const { remark42 } = await services();
    expect(remark42?.environment?.ADMIN_SHARED_EMAIL).toMatch(
      /REMARK_ADMIN_EMAIL/,
    );
    expect(remark42?.environment?.NOTIFY_ADMINS).toBe('email');
    expect(remark42?.environment?.NOTIFY_EMAIL_FROM).toMatch(/MAIL_FROM/);
  });

  it('requires the administrator email in production, where a guessable default would be a risk', async () => {
    for (const file of ['compose.production.yaml', 'compose.domain.yaml']) {
      const { remark42 } = await services(file);
      expect(remark42?.environment?.ADMIN_SHARED_EMAIL, file).toMatch(/:\?/);
    }
  });
});
