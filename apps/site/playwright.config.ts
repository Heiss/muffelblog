import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;
const PORT_DE = 4323;

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    // Lokal kann ein vorinstalliertes Chromium genutzt werden.
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || undefined,
    },
  },
  // The whole suite runs against the English build (the default). A small suite
  // runs against a German build (`pnpm build:de`), see e2e/language-de.spec.ts.
  projects: [
    {
      name: 'en',
      testIgnore: /language-de/,
      use: { baseURL: `http://localhost:${PORT}` },
    },
    {
      name: 'de',
      testMatch: /language-de/,
      use: { baseURL: `http://localhost:${PORT_DE}` },
    },
  ],
  webServer: [PORT, PORT_DE].map((port, i) => ({
    // Tests the built site, not the dev server. `astro preview` starts itself
    // in the background without a terminal and is therefore not suitable for Playwright.
    command: `pnpm exec sirv ${i === 0 ? 'dist' : 'dist-de'} --port ${port} --host localhost --quiet`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
  })),
});
