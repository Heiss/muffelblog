import { expect, test } from '@playwright/test';

test.describe('Artikelseiten unter /p/<slug>/', () => {
  test('zeigt Titel, Datum und Tags eines Artikels', async ({ page }) => {
    await page.goto('/p/hallo-welt/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page).toHaveTitle('Hallo Welt – Muffelblog');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Hallo Welt',
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'Der erste Artikel.',
    );
    // Reines Datum gilt als 12:00 Uhr in Berlin, im Januar sind das 11:00 UTC.
    await expect(page.locator('time')).toHaveAttribute(
      'datetime',
      '2026-01-05T11:00:00.000Z',
    );
    await expect(
      page.getByRole('list', { name: 'Tags' }).getByRole('listitem'),
    ).toHaveText(['python', 'ml']);
  });

  test('bildet Slug und Titel aus dem Dateinamen mit Umlauten', async ({
    page,
  }) => {
    await page.goto('/p/groesse-und-masse/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Größe und Maße',
    );
    await expect(
      page.getByRole('list', { name: 'Tags' }).getByRole('listitem'),
    ).toHaveText(['über größe']);
  });

  test('liest Uhrzeit mit und ohne Zone', async ({ page }) => {
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

  test('findet Artikel in Unterordnern und ohne Datum', async ({ page }) => {
    const unterordner = await page.goto('/p/tief/');
    expect(unterordner?.status()).toBe(200);
    const ohneDatum = await page.goto('/p/ohne-datum/');
    expect(ohneDatum?.status()).toBe(200);
  });

  test('hängt bei doppeltem Slug ein Suffix an den jüngeren Artikel', async ({
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
    // Direkte Anfrage: Chromium meldet eine leere 404-Antwort als Netzwerkfehler.
    test(`veröffentlicht /p/${slug}/ nicht`, async ({ request }) => {
      const antwort = await request.get(`/p/${slug}/`);
      expect(antwort.status()).toBe(404);
    });
  }
});
