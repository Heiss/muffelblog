import { expect, test } from '@playwright/test';
import { ui } from './helpers';

test.describe('Article pages under /p/<slug>/', () => {
  test('shows title, date and tags of an article', async ({ page }) => {
    await page.goto('/p/hallo-welt/');
    await expect(page.locator('html')).toHaveAttribute('lang', ui.lang);
    await expect(page).toHaveTitle('Hallo Welt – Muffelblog');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Hallo Welt',
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'Der erste Artikel.',
    );
    // A plain date counts as 12:00 in Berlin, in January that is 11:00 UTC.
    await expect(page.locator('article time')).toHaveAttribute(
      'datetime',
      '2026-01-05T11:00:00.000Z',
    );
    await expect(
      page.getByRole('list', { name: ui.tags.label }).getByRole('listitem'),
    ).toHaveText(['python', 'ml']);
  });

  test('builds slug and title from a file name with umlauts', async ({
    page,
  }) => {
    await page.goto('/p/groesse-und-masse/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Größe und Maße',
    );
    await expect(
      page.getByRole('list', { name: ui.tags.label }).getByRole('listitem'),
    ).toHaveText(['über größe']);
  });

  test('reads a time with and without a zone', async ({ page }) => {
    await page.goto('/p/zeit-ohne-zone/');
    await expect(page.locator('time')).toHaveAttribute(
      'datetime',
      '2026-07-01T07:30:00.000Z',
    );
    await page.goto('/p/tief/');
    await expect(page.locator('time')).toHaveAttribute(
      'datetime',
      '2026-07-01T07:30:00.000Z',
    );
  });

  test('finds articles in subfolders and without a date', async ({ page }) => {
    const unterordner = await page.goto('/p/tief/');
    expect(unterordner?.status()).toBe(200);
    const ohneDatum = await page.goto('/p/ohne-datum/');
    expect(ohneDatum?.status()).toBe(200);
  });

  test('appends a suffix to the younger article on a duplicate slug', async ({
    page,
  }) => {
    await page.goto('/p/gleich/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Dublette A',
    );
    await page.goto('/p/gleich-2/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Dublette B',
    );
  });

  for (const slug of [
    'ohne-publish',
    'publish-string',
    'kaputt',
    'wikilink',
    'geheim',
    'konfliktkopie',
    'hallo-welt-conflicted-copy-2026-01-05-100000',
  ]) {
    // Direct request: Chromium reports an empty 404 response as a network error.
    test(`does not publish /p/${slug}/`, async ({ request }) => {
      const antwort = await request.get(`/p/${slug}/`);
      expect(antwort.status()).toBe(404);
    });
  }
});
