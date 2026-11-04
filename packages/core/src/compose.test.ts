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
  restart?: string;
  depends_on?: Record<string, { condition?: string }>;
}

async function services(): Promise<Record<string, Service>> {
  const doc = parse(await readFile(file, 'utf8')) as {
    services: Record<string, Service>;
  };
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
