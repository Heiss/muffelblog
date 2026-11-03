import { defineConfig } from 'vitest/config';

// Contract-Tests gegen echte Dienste. Sie laufen nur, wenn die jeweilige
// MEMOS_CONTRACT_URL gesetzt ist, und gehören nicht zu `pnpm test`.
export default defineConfig({
  test: {
    include: ['packages/*/contract/**/*.contract.test.ts'],
    testTimeout: 60_000,
  },
});
