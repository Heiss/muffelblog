import { expect, test } from '@playwright/test';
import { interceptForeign, ui } from './helpers';

test.describe('Search', () => {
  test('finds posts, memos and terms and links to their pages', async ({
    page,
  }) => {
    await page.goto('/search/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      ui.search.title,
    );
    await page.getByRole('searchbox').fill('Renovate');
    const results = page.locator('[data-search-results]');
    await expect(results.getByRole('link').first()).toBeVisible();
    await expect(results.getByRole('link').first()).toHaveAttribute(
      'href',
      /^\/m\//,
    );
  });

  test('finds a term by its text', async ({ page }) => {
    await page.goto('/search/');
    await page.getByRole('searchbox').fill('Ergebnisse');
    await expect(
      page.getByRole('link', { name: /Cache/ }).first(),
    ).toHaveAttribute('href', '/g/cache/');
  });

  test('filters by kind with the same names as the feed', async ({ page }) => {
    await page.goto('/search/');
    await page.getByRole('searchbox').fill('Hallo');
    const pills = page.getByRole('group', { name: ui.search.kind });
    await expect(pills.getByRole('button')).toHaveText([
      ui.search.all,
      ui.filter.long,
      ui.filter.terms,
    ]);
    await pills.getByRole('button', { name: ui.filter.terms }).click();
    const links = page.locator('[data-search-results] a[href]');
    await expect(links.first()).toHaveAttribute('href', /^\/g\//);
    for (const href of await links.evaluateAll((els) =>
      els.map((e) => e.getAttribute('href')),
    )) {
      expect(href).toMatch(/^\/g\//);
    }
  });

  test('does not find technical blocks or listing pages', async ({ page }) => {
    await page.goto('/search/');
    await page.getByRole('searchbox').fill(ui.feed.older);
    await expect(page.locator('[data-search-summary]')).toContainText(
      'No results',
    );
    const hrefs = await page
      .locator('[data-search-results] a[href]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    expect(hrefs.filter((h) => /\/page\/\d+\//.test(h ?? ''))).toEqual([]);
  });

  test('makes no foreign requests', async ({ page }) => {
    const foreign = await interceptForeign(page);
    await page.goto('/search/');
    await page.getByRole('searchbox').fill('Hallo');
    await expect(page.locator('[data-search-results] a').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(foreign).toEqual([]);
  });

  test('says that JavaScript is needed when it is off', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/search/');
    await expect(page.getByText('JavaScript')).toBeVisible();
    await context.close();
  });

  test('is linked in the navigation', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: ui.nav.label })
      .getByRole('link', { name: ui.nav.search })
      .click();
    await expect(page).toHaveURL(/\/search\/$/);
  });
});

test.describe('Search index', () => {
  test('only content pages are indexed', async ({ request }) => {
    for (const path of ['/p/hallo-welt/', '/g/cache/']) {
      const html = await (await request.get(path)).text();
      expect(html).toContain('data-pagefind-body');
    }
    for (const path of ['/', '/page/2/', '/posts/', '/tag/', '/search/']) {
      const html = await (await request.get(path)).text();
      expect(html).not.toContain('data-pagefind-body');
    }
  });
});
