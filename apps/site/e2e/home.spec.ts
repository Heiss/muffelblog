import { expect, test } from '@playwright/test';

test('The home page is German and carries the site name', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page).toHaveTitle('Muffelblog');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Muffelblog',
  );
});

test('The home page loads nothing from foreign domains', async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL ?? 'http://localhost').origin;
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith('http') && new URL(url).origin !== origin) {
      foreign.push(url);
    }
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(foreign).toEqual([]);
});
