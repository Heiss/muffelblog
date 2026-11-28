import { expect, test } from '@playwright/test';
import type { Browser } from '@playwright/test';
import { ui } from './helpers';

// Layout W24 (okf/frontend/layout.md): sidebar from 900 px, top and bottom bar
// below, timeline with day zones, page band, glossary, tags and graph tools.

const PHONE = { width: 390, height: 844 };

async function phone(browser: Browser, javaScriptEnabled = true) {
  const context = await browser.newContext({
    viewport: PHONE,
    javaScriptEnabled,
  });
  return { context, page: await context.newPage() };
}

test.describe('Sidebar (wide screen)', () => {
  test('carries name, counts, search, navigation, theme and footer links', async ({
    page,
  }) => {
    await page.goto('/');
    const side = page.locator('#site-menu');
    await expect(side).toBeVisible();
    await expect(side.locator('.counts')).toHaveText(ui.nav.counts(9, 6, 3));
    await expect(
      side.getByRole('navigation', { name: ui.nav.label }).getByRole('link', {
        name: ui.nav.home,
      }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(side.locator('[data-theme-switch]')).toBeVisible();
    await expect(side.locator('.site-footer')).toBeVisible();
    // The bars of the phone are not there on a wide screen.
    await expect(page.locator('.bottombar')).toBeHidden();
    await expect(page.locator('.topbar')).toBeHidden();
  });

  test('the search field sends its words to the search page, which searches at once', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByRole('search')
      .getByRole('searchbox', { name: ui.nav.search })
      .fill('Renovate');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/search\/\?q=Renovate$/);
    await expect(page.getByRole('searchbox')).toHaveValue('Renovate');
    await expect(
      page.locator('[data-search-results]').getByRole('link').first(),
    ).toHaveAttribute('href', /^\/m\//);
  });

  test('a post shows its table of contents in the sidebar', async ({
    page,
  }) => {
    await page.goto('/p/rendering-demo/');
    const toc = page.getByRole('navigation', { name: ui.page.contents });
    await expect(toc.getByRole('link')).toHaveText(['Abschnitt', 'Weiteres']);
    await toc.getByRole('link', { name: 'Weiteres' }).click();
    await expect(page).toHaveURL(/#weiteres$/);
    await expect(page.locator('#weiteres')).toBeInViewport();
  });
});

test.describe('Phone', () => {
  test('has a top bar and a bottom bar with five targets', async ({
    browser,
  }) => {
    const { context, page } = await phone(browser);
    await page.goto('/tag/');
    await expect(page.locator('.topbar')).toBeVisible();
    const bar = page.getByRole('navigation', { name: ui.nav.quick });
    await expect(bar.getByRole('link')).toHaveText([
      ui.nav.home,
      ui.nav.glossary,
      ui.nav.tags,
      ui.nav.search,
      ui.nav.menu,
    ]);
    await expect(bar.getByRole('link', { name: ui.nav.tags })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.locator('#site-menu')).toBeHidden();
    await context.close();
  });

  test('the menu slides in from the right and closes with Escape', async ({
    browser,
  }) => {
    const { context, page } = await phone(browser);
    await page.goto('/');
    const menuTab = page
      .getByRole('navigation', { name: ui.nav.quick })
      .getByRole('link', { name: ui.nav.menu });
    await menuTab.click();
    const menu = page.locator('#site-menu');
    await expect(menu).toBeVisible();
    await expect(menuTab).toHaveAttribute('aria-expanded', 'true');
    await expect(
      menu.getByRole('navigation', { name: ui.nav.label }).getByRole('link', {
        name: ui.nav.graph,
      }),
    ).toBeVisible();
    // The tools of the page (here the filter) are in the menu too.
    await expect(
      menu.getByRole('navigation', { name: ui.filter.label }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(menuTab).toHaveAttribute('aria-expanded', 'false');
    await context.close();
  });

  test('the menu opens without JavaScript through its anchor', async ({
    browser,
  }) => {
    const { context, page } = await phone(browser, false);
    await page.goto('/');
    await page
      .getByRole('navigation', { name: ui.nav.quick })
      .getByRole('link', { name: ui.nav.menu })
      .click();
    await expect(page).toHaveURL(/#site-menu$/);
    await expect(page.locator('#site-menu')).toBeVisible();
    await page.locator('#site-menu .menu-close').click();
    await expect(page.locator('#site-menu')).toBeHidden();
    await context.close();
  });

  test('search slides in from the right and finds entries', async ({
    browser,
  }) => {
    const { context, page } = await phone(browser);
    await page.goto('/');
    const searchTab = page
      .getByRole('navigation', { name: ui.nav.quick })
      .getByRole('link', { name: ui.nav.search });
    await searchTab.click();
    const panel = page.getByRole('dialog', { name: ui.search.title });
    await expect(panel).toBeVisible();
    await expect(page).toHaveURL(/localhost:\d+\/$/);
    const input = panel.getByRole('searchbox');
    await expect(input).toBeFocused();
    await input.fill('Renovate');
    await expect(
      panel.locator('[data-search-results]').getByRole('link').first(),
    ).toHaveAttribute('href', /^\/m\//);
    await panel.getByRole('button', { name: ui.nav.close }).click();
    await expect(panel).toBeHidden();
    await context.close();
  });

  test('without JavaScript the search tab leads to the search page', async ({
    browser,
  }) => {
    const { context, page } = await phone(browser, false);
    await page.goto('/');
    await page
      .getByRole('navigation', { name: ui.nav.quick })
      .getByRole('link', { name: ui.nav.search })
      .click();
    await expect(page).toHaveURL(/\/search\/$/);
    await context.close();
  });

  test('pages of the new layout do not scroll sideways', async ({
    browser,
  }) => {
    const { context, page } = await phone(browser);
    for (const path of [
      '/glossary/',
      '/graph/',
      '/m/memo-text/',
      '/g/cache/',
      '/updated/',
    ]) {
      await page.goto(path);
      const wider = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(wider, path).toBe(false);
    }
    await context.close();
  });
});

test.describe('Timeline', () => {
  test('groups the entries by day, every day once, the date stays at the top', async ({
    page,
  }) => {
    await page.goto('/');
    await expect
      .poll(async () => {
        await page.evaluate(() =>
          window.scrollTo(0, document.documentElement.scrollHeight),
        );
        return page.locator('[data-feed-list] article[data-id]').count();
      })
      .toBe(18);
    const days = await page
      .locator('[data-feed-list] > section[data-day]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-day')));
    expect(days.length).toBeGreaterThan(1);
    expect(new Set(days).size).toBe(days.length);
    expect(days).toEqual([...days].sort().reverse());
    const position = await page
      .locator('.day-date')
      .first()
      .evaluate((el) => getComputedStyle(el).position);
    expect(position).toBe('sticky');
  });

  test('bundles the terms of one day into one entry under "All"', async ({
    page,
  }) => {
    // The test build gives all terms the same change day, so /updated/ bundles them.
    await page.goto('/updated/');
    const bundle = page.locator('article[data-kind="bundle"]');
    await expect(bundle).toHaveCount(1);
    await expect(bundle).toContainText(ui.feed.newTerms(3));
    await bundle.getByText(ui.feed.showAllTerms(3)).click();
    await expect(bundle.locator('.term-list a')).toHaveCount(3);
    // The series of the terms lists them one by one.
    await page.goto('/terms/updated/');
    await expect(page.locator('article[data-kind="bundle"]')).toHaveCount(0);
    await expect(page.locator('article[data-kind="glossary"]')).toHaveCount(3);
  });
});

test.describe('Band below the text', () => {
  test('is open on a wide screen with graph and links', async ({ page }) => {
    await page.goto('/p/rendering-demo/');
    const band = page.locator('details.band');
    await expect(band).toHaveAttribute('open', '');
    await expect(band.locator('summary')).toContainText(ui.page.more);
    await expect(band.locator('.graph-local svg')).toBeVisible();
  });

  test('is closed on a phone and opens with a tap', async ({ browser }) => {
    const { context, page } = await phone(browser);
    await page.goto('/p/rendering-demo/');
    const band = page.locator('details.band');
    await expect(band).not.toHaveAttribute('open', '');
    await band.locator('summary').click();
    await expect(band.locator('.graph-local svg')).toBeVisible();
    await context.close();
  });

  test('stays open without JavaScript', async ({ browser }) => {
    const { context, page } = await phone(browser, false);
    await page.goto('/p/rendering-demo/');
    await expect(page.locator('details.band')).toHaveAttribute('open', '');
    await context.close();
  });
});

test.describe('Overviews', () => {
  test('the glossary has its letters in the sidebar and filters terms', async ({
    page,
  }) => {
    await page.goto('/glossary/');
    const letters = page
      .locator('#site-menu')
      .getByRole('navigation', { name: ui.glossary.lettersLabel });
    await expect(letters.getByRole('link')).toHaveText(['A', 'C', 'H']);
    const filter = page.getByPlaceholder(ui.glossary.filter);
    await filter.fill('zwischenspeicher');
    await expect(page.locator('.letter-group li:visible')).toHaveCount(1);
    await expect(page.locator('.letter-group:visible h2')).toHaveText(['C']);
    await filter.fill('');
    await expect(page.locator('.letter-group li:visible')).toHaveCount(3);
  });

  test('tags show a cloud first and a list on demand', async ({ page }) => {
    await page.goto('/tag/');
    const cloud = page.locator('.tag-cloud');
    await expect(cloud).toBeVisible();
    await expect(page.locator('.tag-index')).toBeHidden();
    await expect(cloud.locator('li.step-6')).toHaveCount(1);
    await page.getByText(ui.tags.list, { exact: true }).click();
    await expect(page.locator('.tag-index')).toBeVisible();
    await expect(cloud).toBeHidden();
  });

  test('the graph opens on the newest linked post and can show everything', async ({
    page,
  }) => {
    await page.goto('/graph/');
    const tools = page.locator('[data-graph-tools]');
    await expect(tools).toBeVisible();
    await expect(tools.locator('[data-graph-focus-name]')).toHaveText(
      'Rendering-Demo',
    );
    await expect(
      tools.locator('[data-graph-neighbours]').getByRole('link', {
        name: 'Cache',
      }),
    ).toHaveAttribute('href', '/g/cache/');
    await expect(page.locator('.graph-svg .node.faded').first()).toBeAttached();
    await tools.getByRole('button', { name: ui.graph.showAll }).click();
    await expect(page.locator('.graph-svg .node.faded')).toHaveCount(0);
    await expect(
      tools.getByRole('button', { name: ui.graph.showFocus }),
    ).toBeVisible();
  });

  // Owner, 2026-11-28: a click focuses, a double click opens the page,
  // Ctrl or Cmd with a click opens it in a new tab.
  test('a click on a point makes it the focus, a double click opens its page', async ({
    page,
  }) => {
    await page.goto('/graph/');
    const tools = page.locator('[data-graph-tools]');
    const svg = page.locator('figure.graph-all svg');
    const cache = svg.locator('a[href="/g/cache/"]');
    await expect(cache).toBeVisible();
    await cache.locator('circle').click();
    await expect(page).toHaveURL(/\/graph\/$/);
    const name = tools.locator('[data-graph-focus-name]');
    await expect(name).toHaveText('Cache');
    await expect(cache).toHaveClass(/focus-point/);
    await expect(svg.locator('.node.focus-point')).toHaveCount(1);
    await expect(svg.locator('.edge.focus-edge').first()).toBeAttached();
    // A click without a move pins nothing.
    await expect(cache).not.toHaveClass(/pinned/);
    // The name of the focus leads to its page.
    await expect(name.getByRole('link', { name: 'Cache' })).toHaveAttribute(
      'href',
      '/g/cache/',
    );
    await cache.locator('circle').dblclick();
    await expect(page).toHaveURL(/\/g\/cache\/$/);
  });

  test('Ctrl or Cmd with a click opens the page in a new tab and keeps the focus', async ({
    page,
    context,
  }) => {
    await page.goto('/graph/');
    const name = page.locator('[data-graph-focus-name]');
    await expect(name).toHaveText('Rendering-Demo');
    const cache = page.locator('figure.graph-all svg a[href="/g/cache/"]');
    await expect(cache).toBeVisible();
    const [tab] = await Promise.all([
      context.waitForEvent('page'),
      cache.locator('circle').click({ modifiers: ['ControlOrMeta'] }),
    ]);
    await tab.waitForLoadState();
    expect(tab.url()).toMatch(/\/g\/cache\/$/);
    await expect(page).toHaveURL(/\/graph\/$/);
    await expect(name).toHaveText('Rendering-Demo');
  });

  test('Enter on a point makes it the focus', async ({ page }) => {
    await page.goto('/graph/');
    const cache = page.locator('figure.graph-all svg a[href="/g/cache/"]');
    await expect(cache).toBeVisible();
    await cache.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/graph\/$/);
    await expect(page.locator('[data-graph-focus-name]')).toHaveText('Cache');
  });
});
