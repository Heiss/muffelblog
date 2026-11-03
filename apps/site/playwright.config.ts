import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Desktop Chrome'],
    // Lokal kann ein vorinstalliertes Chromium genutzt werden.
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || undefined,
    },
  },
  webServer: {
    // Tests the built site, not the dev server. `astro preview` starts itself
    // in the background without a terminal and is therefore not suitable for Playwright.
    command: `pnpm exec sirv dist --port ${PORT} --host localhost --quiet`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
