import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Build-time constant of the site (see apps/site/astro.config.mjs).
  define: { __MUFFEL_LANG__: JSON.stringify(process.env.MUFFEL_LANG ?? '') },
  test: {
    include: ['apps/*/src/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
  },
});
