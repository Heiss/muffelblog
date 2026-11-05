import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ui } from './helpers';

interface Entry {
  id: string;
  kind: string;
  date: string;
  tags: string[];
}

const newEntry = (id: string, kind = 'post', tags: string[] = []): Entry => ({
  id,
  kind,
  date: '2099-01-01T00:00:00.000Z',
  tags,
});

/**
 * Pretends that the site is rebuilt: `/build.json` answers with the given id
 * and `/entries.json` with the real list plus the given new entries. The counters
 * show how often the page asked.
 */
async function pretend(page: Page, real: { limit: number; entries: Entry[] }) {
  const state = { id: 'build-1', extra: [] as Entry[], builds: 0, lists: 0 };
  await page.route('**/build.json', (route) => {
    state.builds += 1;
    return route.fulfill({
      json: { id: state.id, builtAt: '2099-01-01T00:00:00Z' },
    });
  });
  await page.route('**/entries.json', (route) => {
    state.lists += 1;
    return route.fulfill({
      json: { limit: real.limit, entries: [...state.extra, ...real.entries] },
    });
  });
  return state;
}

test.describe('Banner "N new entries"', () => {
  let real: { limit: number; entries: Entry[] };
  test.beforeEach(async ({ request }) => {
    real = await (await request.get('/entries.json')).json();
  });

  test('/entries.json lists the newest entries and nothing else', async ({
    request,
  }) => {
    const list = real;
    expect(list.limit).toBe(20);
    expect(list.entries.length).toBeGreaterThan(5);
    expect(list.entries.length).toBeLessThanOrEqual(20);
    const dates = list.entries.map((e) => Date.parse(e.date));
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
    expect(new Set(list.entries.map((e) => e.id)).size).toBe(
      list.entries.length,
    );
    for (const entry of list.entries) {
      expect(Object.keys(entry).sort()).toEqual(['date', 'id', 'kind', 'tags']);
    }
    const response = await request.get('/entries.json');
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('shows the number when a new build brings newer entries, and a click shows the top', async ({
    page,
  }) => {
    await page.clock.install();
    const state = await pretend(page, real);
    await page.goto('/');
    await page.clock.runFor(1000);
    await expect(page.locator('[data-live-banner]')).toBeHidden();

    state.id = 'build-2';
    state.extra = [newEntry('post:n2'), newEntry('post:n1')];
    await page.clock.fastForward(61_000);
    const banner = page.locator('[data-live-banner]');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveText(ui.live.many(2));
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);

    await page.evaluate(() => window.scrollTo(0, 400));
    await banner.getByRole('button').click();
    await expect(banner).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(
      page.locator('[data-feed-list] article').first(),
    ).toBeVisible();
  });

  test('says "1 new entry" for one', async ({ page }) => {
    await page.clock.install();
    const state = await pretend(page, real);
    await page.goto('/');
    await page.clock.runFor(1000);
    state.id = 'build-2';
    state.extra = [newEntry('post:only')];
    await page.clock.fastForward(61_000);
    await expect(page.locator('[data-live-banner]')).toHaveText(ui.live.one);
  });

  test('stays away when only a comment changed: new build, same entries', async ({
    page,
  }) => {
    await page.clock.install();
    const state = await pretend(page, real);
    await page.goto('/');
    await page.clock.runFor(1000);
    state.id = 'build-2';
    await page.clock.fastForward(61_000);
    await expect.poll(() => state.lists).toBe(1);
    await page.waitForTimeout(300); // time to count before the negative check
    await expect(page.locator('[data-live-banner]')).toBeHidden();
  });

  test('asks for the list only when the build changed', async ({ page }) => {
    await page.clock.install();
    const state = await pretend(page, real);
    await page.goto('/');
    await page.clock.runFor(1000);
    await page.clock.fastForward(61_000);
    await page.clock.fastForward(61_000);
    // The requests of the timers arrive a moment after the clock has moved.
    await expect.poll(() => state.builds).toBeGreaterThanOrEqual(3);
    expect(state.lists).toBe(0);
  });

  test('counts only the kind of the series: a new post does not count in the short series', async ({
    page,
  }) => {
    await page.clock.install();
    const state = await pretend(page, real);
    await page.goto('/memos/');
    await page.clock.runFor(1000);
    state.id = 'build-2';
    state.extra = [newEntry('post:p')];
    await page.clock.fastForward(61_000);
    await expect.poll(() => state.lists).toBe(1);
    await page.waitForTimeout(300); // time to count before the negative check
    await expect(page.locator('[data-live-banner]')).toBeHidden();

    state.id = 'build-3';
    state.extra = [newEntry('post:p'), newEntry('memo:m', 'memo')];
    await page.clock.fastForward(61_000);
    await expect(page.locator('[data-live-banner]')).toHaveText(ui.live.one);
  });

  test('on a tag page only entries with that tag count', async ({ page }) => {
    await page.clock.install();
    const state = await pretend(page, real);
    await page.goto('/tag/tooling/');
    await page.clock.runFor(1000);
    state.id = 'build-2';
    state.extra = [newEntry('post:other', 'post', ['other'])];
    await page.clock.fastForward(61_000);
    await expect.poll(() => state.lists).toBe(1);
    await page.waitForTimeout(300); // time to count before the negative check
    await expect(page.locator('[data-live-banner]')).toBeHidden();
    state.id = 'build-3';
    state.extra = [newEntry('post:t', 'post', ['tooling'])];
    await page.clock.fastForward(61_000);
    await expect(page.locator('[data-live-banner]')).toHaveText(ui.live.one);
  });

  test('later blocks and article pages do not poll at all', async ({
    page,
  }) => {
    await page.clock.install();
    const state = await pretend(page, real);
    for (const url of ['/page/2/', '/p/hallo-welt/']) {
      await page.goto(url);
      await page.clock.fastForward(121_000);
    }
    // Real time for a request that would still be on its way.
    await page.waitForTimeout(300);
    expect(state.builds).toBe(0);
  });

  test('does not poll while the tab is hidden, and asks again when it comes back', async ({
    page,
  }) => {
    await page.clock.install();
    const state = await pretend(page, real);
    await page.goto('/');
    await page.clock.runFor(1000);
    const before = state.builds;
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
    });
    await page.clock.fastForward(181_000);
    await page.waitForTimeout(300);
    expect(state.builds).toBe(before);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(() => state.builds).toBeGreaterThan(before);
  });

  test('works with a failing build.json: no banner, no error', async ({
    page,
  }) => {
    await page.clock.install();
    await page.route('**/build.json', (route) =>
      route.fulfill({ status: 500 }),
    );
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await page.clock.fastForward(121_000);
    await expect(page.locator('[data-live-banner]')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('without JavaScript the banner is not shown', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('[data-live-banner]')).toBeHidden();
    await context.close();
  });
});
