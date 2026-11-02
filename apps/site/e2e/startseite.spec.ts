import { expect, test } from '@playwright/test';

test('Startseite ist deutsch und trägt den Seitennamen', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page).toHaveTitle('Muffelblog');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Muffelblog',
  );
});

test('Startseite lädt nichts von Fremddomains', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? 'http://localhost').origin;
  const fremd: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith('http') && new URL(url).origin !== origin) {
      fremd.push(url);
    }
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(fremd).toEqual([]);
});
