import { expect, test } from '@playwright/test';
import { catalogs } from '../src/i18n/catalogs.ts';

// Runs against the German build (MUFFEL_LANG=de). The whole rest of the suite
// runs against the English build; this file checks that the language switch
// reaches the page, the feed, the scripts and the generated texts.
const de = catalogs.de;

test.describe('German UI (MUFFEL_LANG=de)', () => {
  test('sets the language of the page and shows the navigation in German', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    const nav = page.getByRole('navigation', { name: de.nav.label });
    await expect(nav.getByRole('link', { name: de.nav.search })).toBeVisible();
    await expect(page.getByLabel(de.theme.label)).toBeVisible();
    await expect(
      page.getByLabel(de.theme.label).locator('option[value="hell"]'),
    ).toHaveText('Hell');
  });

  test('shows filter, pager and memo titles in German', async ({ page }) => {
    await page.goto('/');
    const filter = page.getByRole('navigation', { name: de.filter.label });
    await expect(filter.getByRole('link')).toHaveText([
      de.filter.all,
      de.filter.long,
      de.filter.short,
      de.filter.terms,
    ]);
    // The pager text is only visible without JavaScript, it is in the page either way.
    await expect(page.getByText(de.feed.pageOf(1, 5))).toHaveCount(1);
    await expect(
      page.getByRole('link', { name: 'Memo vom 2. Nov. 2026, 14:32' }),
    ).toBeVisible();
  });

  test('loads more entries in German when the request fails', async ({
    page,
  }) => {
    await page.route('**/page/2/', (route) => route.abort());
    await page.goto('/');
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await expect(page.locator('[data-feed-status]')).toContainText(
      de.feed.loadFailed.trim(),
    );
    await expect(page.getByRole('link', { name: de.feed.older })).toBeVisible();
  });

  test('searches in German', async ({ page }) => {
    await page.goto('/search/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      de.search.title,
    );
    await page.getByRole('searchbox').fill('Hallo');
    await expect(
      page.getByRole('group', { name: de.search.kind }),
    ).toBeVisible();
    await expect(page.locator('[data-search-summary]')).toContainText(
      'Treffer',
    );
  });

  test('uses the German locale of the comments widget and the German notices', async ({
    page,
  }) => {
    await page.goto('/p/hallo-welt/');
    await expect(
      page
        .locator('#comments')
        .getByRole('heading', { name: de.comments.title }),
    ).toBeVisible();
    await expect(page.locator('#comments')).toHaveAttribute(
      'data-locale',
      'de',
    );
  });

  test('writes the generated texts of the content in German', async ({
    page,
  }) => {
    await page.goto('/p/rendering-demo/');
    await expect(page.locator('.content .image-missing')).toContainText(
      'Bild fehlt',
    );
  });

  test('has a German 404 page', async ({ request }) => {
    // The static server answers an unknown address with an empty 404, the
    // reverse proxy serves this file for it (see docker/Caddyfile).
    const response = await request.get('/404.html');
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain(`<h1>${de.notFound.title}</h1>`);
  });
});
