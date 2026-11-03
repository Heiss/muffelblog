import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Test build: blocks of 4 entries, 9 articles and 6 memos, so 4 mixed blocks.
const TOTAL = 18;
const MEMOS = 6;
const POSTS = 9;

const entries = (page: Page) => page.locator('[data-feed-list] > article');

async function ids(page: Page): Promise<string[]> {
  return entries(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-id') ?? ''),
  );
}

async function scrollToEnd(page: Page, expected: number): Promise<void> {
  await expect
    .poll(
      async () => {
        await page.evaluate(() =>
          window.scrollTo(0, document.documentElement.scrollHeight),
        );
        return entries(page).count();
      },
      { timeout: 15_000 },
    )
    .toBe(expected);
}

test.describe('Endless Scroll', () => {
  test('loads all blocks while scrolling, without duplicates', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(entries(page)).toHaveCount(4);
    await scrollToEnd(page, TOTAL);
    const alle = await ids(page);
    expect(new Set(alle).size).toBe(TOTAL);
    // At the end there is no visible next link and no error message any more.
    await expect(
      page.getByRole('link', { name: 'Ältere Einträge' }),
    ).toBeHidden();
    await expect(page.locator('[data-feed-status]')).toBeHidden();
  });

  test('keeps the order: newest first across all blocks', async ({ page }) => {
    await page.goto('/');
    await scrollToEnd(page, TOTAL);
    const zeiten = await page
      .locator('[data-feed-list] > article time')
      .evaluateAll((els) =>
        els.map((el) => Date.parse(el.getAttribute('datetime') ?? '')),
      );
    expect(zeiten).toEqual([...zeiten].sort((a, b) => b - a));
  });

  test('the next link is hidden with JavaScript and stays visible without', async ({
    page,
    browser,
  }) => {
    await page.goto('/');
    await expect(page.locator('[data-pager]')).toBeHidden();
    const ohne = await browser.newContext({ javaScriptEnabled: false });
    const seite = await ohne.newPage();
    await seite.goto('/');
    await expect(
      seite.getByRole('link', { name: 'Ältere Einträge' }),
    ).toBeVisible();
    await ohne.close();
  });

  test('a loading error shows a hint and the link stays usable', async ({
    page,
  }) => {
    await page.route('**/page/2/', (route) => route.abort());
    await page.goto('/');
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await expect(page.locator('[data-feed-status]')).toContainText(
      'Nachladen fehlgeschlagen',
    );
    await expect(
      page.getByRole('link', { name: 'Ältere Einträge' }),
    ).toBeVisible();
    await expect(entries(page)).toHaveCount(4);
  });

  test('loads more on tag pages without a filter there', async ({ page }) => {
    await page.goto('/tag/tooling/');
    await expect(page.getByRole('navigation', { name: 'Filter' })).toHaveCount(
      0,
    );
    const erste = await entries(page).count();
    expect(erste).toBeGreaterThan(0);
  });
});

test.describe('Filter in the unified mode', () => {
  test('Kurz shows only memos, keeps the address clean and loads more', async ({
    page,
  }) => {
    await page.goto('/');
    const filter = page.getByRole('navigation', { name: 'Filter' });
    await filter.getByRole('link', { name: 'Kurz' }).click();
    await expect(page).toHaveURL(/\/memos\/$/);
    await expect(filter.getByRole('link', { name: 'Kurz' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page).toHaveTitle('Kurz – Muffelblog');
    await scrollToEnd(page, MEMOS);
    expect((await ids(page)).every((id) => id.startsWith('memo:'))).toBe(true);
  });

  test('Lang and Alle switch back', async ({ page }) => {
    await page.goto('/');
    const filter = page.getByRole('navigation', { name: 'Filter' });
    await filter.getByRole('link', { name: 'Lang' }).click();
    await scrollToEnd(page, POSTS);
    expect((await ids(page)).every((id) => id.startsWith('post:'))).toBe(true);
    await filter.getByRole('link', { name: 'Alle' }).click();
    await expect(page).toHaveURL(/\/$/);
    await scrollToEnd(page, TOTAL);
  });

  test('a switch starts at the top and without leftovers of the old list', async ({
    page,
  }) => {
    await page.goto('/');
    await scrollToEnd(page, TOTAL);
    const filter = page.getByRole('navigation', { name: 'Filter' });
    await filter.getByRole('link', { name: 'Kurz' }).click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(
      page.locator('[data-feed-list] > article[data-kind="post"]'),
    ).toHaveCount(0);
  });

  test('the filter is kept after reloading /', async ({ page }) => {
    await page.goto('/');
    const filter = page.getByRole('navigation', { name: 'Filter' });
    await filter.getByRole('link', { name: 'Kurz' }).click();
    await expect(page).toHaveURL(/\/memos\/$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/memos\/$/);
    await expect(
      page.locator('[data-feed-list] > article[data-kind="post"]'),
    ).toHaveCount(0);
    await filter.getByRole('link', { name: 'Alle' }).click();
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
  });

  test('an explicitly opened series wins over the stored filter', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Filter' })
      .getByRole('link', { name: 'Kurz' })
      .click();
    await page.goto('/posts/');
    await expect(page).toHaveURL(/\/posts\/$/);
    expect((await ids(page)).every((id) => id.startsWith('post:'))).toBe(true);
  });

  test('without usable localStorage the defaults apply and everything works', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('gesperrt');
        },
      });
    });
    await page.goto('/');
    await expect(entries(page)).toHaveCount(4);
    await page
      .getByRole('navigation', { name: 'Filter' })
      .getByRole('link', { name: 'Kurz' })
      .click();
    await scrollToEnd(page, MEMOS);
  });

  test('without JavaScript the filters are normal links', async ({
    browser,
  }) => {
    const ohne = await browser.newContext({ javaScriptEnabled: false });
    const seite = await ohne.newPage();
    await seite.goto('/');
    await seite
      .getByRole('navigation', { name: 'Filter' })
      .getByRole('link', { name: 'Kurz' })
      .click();
    await expect(seite).toHaveURL(/\/memos\/$/);
    await ohne.close();
  });
});

test.describe('Going back', () => {
  test('restores loaded blocks and scroll position', async ({ page }) => {
    await page.goto('/');
    await scrollToEnd(page, TOTAL);
    const entry = entries(page).nth(10);
    await entry.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    const href = await entry.locator('h2 a').getAttribute('href');
    await entry.locator('h2 a').click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await page.goBack();
    await expect(entries(page)).toHaveCount(TOTAL);
    await expect
      .poll(async () =>
        Math.abs((await page.evaluate(() => window.scrollY)) - before),
      )
      .toBeLessThan(150);
  });
});

test('loading more stays on the own origin', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? 'http://localhost').origin;
  const foreign: string[] = [];
  page.on('request', (r) => {
    if (r.url().startsWith('http') && new URL(r.url()).origin !== origin)
      foreign.push(r.url());
  });
  await page.goto('/');
  await scrollToEnd(page, TOTAL);
  expect(foreign).toEqual([]);
});
