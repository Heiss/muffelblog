import { expect, test } from '@playwright/test';
import { ui } from './helpers';
import type { Page } from '@playwright/test';

// The test build uses blocks of 4 entries (MUFFEL_FEED_PAGE_SIZE), the sample data
// has 9 articles, 3 terms and 6 memos.
// The static structure (blocks, next links) is checked without JavaScript;
// loading more in the browser is covered by feed-client.spec.ts.
test.use({ javaScriptEnabled: false });

const TOTAL = 18;
const BLOCK = 4;

interface Zeile {
  href: string;
  kind: string | null;
  datum: string;
}

async function rows(page: Page): Promise<Zeile[]> {
  return page.locator('article.entry').evaluateAll((els) =>
    els.map((el) => ({
      href: el.querySelector('h2 a')?.getAttribute('href') ?? '',
      kind: el.getAttribute('data-kind'),
      datum: el.querySelector('time')?.getAttribute('datetime') ?? '',
    })),
  );
}

/** Folgt "Ältere Einträge" bis zum Ende und sammelt alle Zeilen. */
async function allPages(page: Page, start: string): Promise<Zeile[]> {
  const alle: Zeile[] = [];
  await page.goto(start);
  for (let i = 0; i < 20; i++) {
    alle.push(...(await rows(page)));
    const weiter = page.getByRole('link', { name: ui.feed.older });
    if ((await weiter.count()) === 0) return alle;
    await weiter.click();
  }
  throw new Error('Zu viele Seiten, Schleife?');
}

test.describe('Shared feed', () => {
  test('shows articles and memos mixed, newest first, without duplicates', async ({
    page,
  }) => {
    const alle = await allPages(page, '/');
    expect(alle).toHaveLength(TOTAL);
    expect(new Set(alle.map((z) => z.href)).size).toBe(TOTAL);
    expect(new Set(alle.map((z) => z.kind))).toEqual(
      new Set(['post', 'memo', 'glossary']),
    );
    const zeiten = alle.map((z) => Date.parse(z.datum));
    expect(zeiten).toEqual([...zeiten].sort((a, b) => b - a));
  });

  test('splits into blocks and links back and forth', async ({ page }) => {
    await page.goto('/');
    expect(await rows(page)).toHaveLength(BLOCK);
    await expect(page.getByText(ui.feed.pageOf(1, 5))).toBeVisible();
    await expect(page.getByRole('link', { name: ui.feed.newer })).toHaveCount(
      0,
    );

    await page.getByRole('link', { name: ui.feed.older }).click();
    await expect(page).toHaveURL(/\/page\/2\/$/);
    await expect(page).toHaveTitle(
      `${ui.feed.pageTitle('Muffelblog', 2)} – Muffelblog`,
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, follow',
    );

    await page.getByRole('link', { name: ui.feed.newer }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });

  test('the last page has no next link, a foreign page number gives 404', async ({
    page,
    request,
  }) => {
    await page.goto('/page/5/');
    expect(await rows(page)).toHaveLength(TOTAL - 4 * BLOCK);
    await expect(page.getByRole('link', { name: ui.feed.older })).toHaveCount(
      0,
    );
    expect((await request.get('/page/6/')).status()).toBe(404);
    expect((await request.get('/page/1/')).status()).toBe(404);
  });

  test('memos appear in full, articles only with an excerpt', async ({
    page,
  }) => {
    await page.goto('/');
    const memo = page.locator('article[data-kind="memo"]').first();
    await expect(memo.locator('.content')).toBeVisible();
    const artikel = page.locator('article[data-kind="post"]').first();
    await expect(artikel.locator('.content')).toHaveCount(0);
    await expect(artikel.locator('.excerpt')).toBeVisible();
  });

  test('titles lead to the own page of the entry', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Memo of 2 Nov 2026, 14:32' }).click();
    await expect(page).toHaveURL(/\/m\/memo-text\/$/);
  });

  test('works without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');
    await page.getByRole('link', { name: ui.feed.older }).click();
    await expect(page).toHaveURL(/\/page\/2\/$/);
    await context.close();
  });

  test('loads nothing from foreign domains', async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? 'http://localhost').origin;
    const foreign: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.startsWith('http') && new URL(url).origin !== origin) {
        foreign.push(url);
      }
    });
    await allPages(page, '/');
    expect(foreign).toEqual([]);
  });
});

test.describe('Filter by kind', () => {
  test('/memos/, /posts/ and /terms/ show only their kind, each complete', async ({
    page,
  }) => {
    await page.goto('/memos/');
    await expect(page).toHaveTitle(`${ui.filter.short} – Muffelblog`);
    const memos = await allPages(page, '/memos/');
    expect(memos.length).toBeGreaterThan(0);
    expect(memos.every((z) => z.kind === 'memo')).toBe(true);

    const posts = await allPages(page, '/posts/');
    expect(posts.length).toBeGreaterThan(0);
    expect(posts.every((z) => z.kind === 'post')).toBe(true);
    const terms = await allPages(page, '/terms/');
    expect(terms.length).toBe(3);
    expect(terms.every((z) => z.kind === 'glossary')).toBe(true);
    expect(memos.length + posts.length + terms.length).toBe(TOTAL);
  });
});

test.describe('Tags', () => {
  test('/tag/ lists all tags with a count', async ({ page }) => {
    await page.goto('/tag/');
    await expect(page).toHaveTitle(`${ui.tags.label} – Muffelblog`);
    const liste = page.getByRole('list', { name: ui.tags.all });
    await expect(liste.getByRole('link', { name: 'tooling' })).toHaveAttribute(
      'href',
      '/tag/tooling/',
    );
    // Nested tags (a/b) have a URL form without a slash.
    await expect(liste.getByRole('link', { name: 'a/b' })).toHaveAttribute(
      'href',
      '/tag/a-b/',
    );
  });

  test('/tag/<tag>/ shows only entries with this tag', async ({ page }) => {
    await page.goto('/tag/tooling/');
    await expect(page).toHaveTitle(`${ui.tags.title('tooling')} – Muffelblog`);
    const z = await rows(page);
    expect(z.map((e) => e.href)).toContain('/m/memo-text/');
    for (const entry of await page.locator('article.entry').all()) {
      await expect(
        entry.getByRole('link', { name: 'tooling', exact: true }),
      ).toBeVisible();
    }
  });

  test('tag links in an entry lead to the tag page', async ({ page }) => {
    await page.goto('/memos/');
    await page
      .locator('article')
      .filter({ hasText: 'Renovate eingerichtet' })
      .getByRole('link', { name: 'tooling', exact: true })
      .click();
    await expect(page).toHaveURL(/\/tag\/tooling\/$/);
  });

  test('an unknown tag gives 404', async ({ request }) => {
    expect((await request.get('/tag/gibt-es-nicht/')).status()).toBe(404);
  });
});

test('without SITE_URL there is no sitemap', async ({ request }) => {
  expect((await request.get('/sitemap.xml')).status()).toBe(404);
});

test('without SITE_URL there is no RSS feed and no feed link', async ({
  request,
}) => {
  expect((await request.get('/feed.xml')).status()).toBe(404);
  const html = await (await request.get('/')).text();
  expect(html).not.toContain('application/rss+xml');
});

test.describe('Sorted by updated (static, without JavaScript)', () => {
  test('lists every entry once, newest update first, and is not indexed', async ({
    page,
  }) => {
    await page.goto('/updated/');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/,
    );
    const hrefs: string[] = [];
    const updated: number[] = [];
    for (let i = 0; i < 20; i++) {
      const rowsHere = await page.locator('article.entry').evaluateAll((els) =>
        els.map((el) => {
          const times = el.querySelectorAll('time');
          return {
            href: el.querySelector('h2 a')?.getAttribute('href') ?? '',
            updated: Date.parse(
              times[times.length - 1]?.getAttribute('datetime') ?? '',
            ),
          };
        }),
      );
      for (const r of rowsHere) {
        hrefs.push(r.href);
        updated.push(r.updated);
      }
      const weiter = page.getByRole('link', { name: ui.feed.older });
      if ((await weiter.count()) === 0) break;
      await weiter.click();
    }
    expect(hrefs).toHaveLength(TOTAL);
    expect(new Set(hrefs).size).toBe(TOTAL);
    expect(updated).toEqual([...updated].sort((a, b) => b - a));
  });

  test('has a sort link per series and marks the current one', async ({
    page,
  }) => {
    for (const [path, updatedPath] of [
      ['/', '/updated/'],
      ['/posts/', '/posts/updated/'],
      ['/memos/', '/memos/updated/'],
      ['/terms/', '/terms/updated/'],
    ] as const) {
      await page.goto(path);
      const nav = page.locator('[data-sort]');
      const created = nav.getByRole('link', { name: ui.sort.created });
      await expect(created).toHaveAttribute('aria-current', 'page');
      await expect(created).toHaveAttribute('href', path);
      await expect(
        nav.getByRole('link', { name: ui.sort.updated }),
      ).toHaveAttribute('href', updatedPath);
    }
  });

  test('shows "updated" only when its calendar day (Berlin) differs from the creation day', async ({
    page,
  }) => {
    await page.goto('/');
    const days = await page.locator('article.entry').evaluateAll((els) => {
      const day = (iso: string | null) =>
        new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(
          new Date(iso ?? ''),
        );
      return els.map((el) => {
        const times = el.querySelectorAll('time');
        return {
          shown: el.querySelector('.updated') !== null,
          differs:
            day(times[0]?.getAttribute('datetime') ?? null) !==
            day(times[times.length - 1]?.getAttribute('datetime') ?? null),
        };
      });
    });
    expect(days.length).toBeGreaterThan(0);
    for (const d of days) expect(d.shown).toBe(d.differs);
  });
});
