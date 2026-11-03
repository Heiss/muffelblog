import { defineConfig } from 'vitest/config';

// Contract tests against real services. They run only if the respective
// MEMOS_CONTRACT_URL is set, and are not part of `pnpm test`.
export default defineConfig({
  test: {
    include: ['packages/*/contract/**/*.contract.test.ts'],
    testTimeout: 60_000,
  },
});
