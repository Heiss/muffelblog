import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Build-time constant of the site (see apps/site/astro.config.mjs).
  define: { __MUFFEL_LANG__: JSON.stringify(process.env.MUFFEL_LANG ?? '') },
  test: {
    include: ['apps/*/src/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
    // Quality gate (W18, owner: strict): the CI runs with --coverage and fails
    // below these numbers.
    coverage: {
      provider: 'v8',
      include: [
        'packages/core/src/**/*.ts',
        'apps/builder/src/**/*.ts',
        'apps/site/src/lib/**/*.ts',
        'apps/site/src/scripts/*-logic.ts',
      ],
      exclude: [
        '**/*.test.ts',
        // Entry points of processes: they only read arguments and call the
        // tested modules. They run in the Compose job of the CI.
        'apps/builder/src/cli.ts',
        'apps/builder/src/*-cli.ts',
        'apps/builder/src/heic-check.ts',
      ],
      thresholds: { lines: 90, branches: 85 },
      reporter: ['text-summary', 'json-summary'],
    },
  },
});
