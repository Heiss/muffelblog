import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const THEMES: Record<string, string> = {
  'solarized-light': 'rgb(253, 246, 227)',
  hell: 'rgb(244, 245, 247)',
  'solarized-dark': 'rgb(0, 43, 54)',
  dracula: 'rgb(40, 42, 54)',
  matrix: 'rgb(0, 10, 2)',
  nord: 'rgb(46, 52, 64)',
  gruvbox: 'rgb(40, 40, 40)',
  monokai: 'rgb(39, 40, 34)',
  'tokyo-night': 'rgb(26, 27, 38)',
  catppuccin: 'rgb(30, 30, 46)',
};

const dataTheme = (page: Page) =>
  page.evaluate(() => document.documentElement.getAttribute('data-theme'));
const background = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe('Default', () => {
  test('light: Solarized Light', async ({ page }) => {
    await page.goto('/');
    expect(await dataTheme(page)).toBe('solarized-light');
    expect(await background(page)).toBe(THEMES['solarized-light']);
  });

  test.describe('with a dark system setting', () => {
    test.use({ colorScheme: 'dark' });
    test('Solarized Dark, a stored choice wins', async ({ page }) => {
      await page.goto('/');
      expect(await dataTheme(page)).toBe('solarized-dark');
      await page.getByLabel('Farbschema').selectOption('hell');
      await page.reload();
      expect(await dataTheme(page)).toBe('hell');
    });
  });
});

test.describe('Switcher', () => {
  test('offers all ten themes', async ({ page }) => {
    await page.goto('/');
    const values = await page
      .getByLabel('Farbschema')
      .locator('option')
      .evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    expect(values.sort()).toEqual(Object.keys(THEMES).sort());
  });

  for (const [id, color] of Object.entries(THEMES)) {
    test(`${id}: takes effect at once, stays after reload and on other pages`, async ({
      page,
    }) => {
      await page.goto('/');
      await page.getByLabel('Farbschema').selectOption(id);
      expect(await dataTheme(page)).toBe(id);
      expect(await background(page)).toBe(color);
      await page.reload();
      expect(await dataTheme(page)).toBe(id);
      expect(await background(page)).toBe(color);
      await page.goto('/tag/');
      expect(await dataTheme(page)).toBe(id);
      await expect(page.getByLabel('Farbschema')).toHaveValue(id);
    });
  }

  test('without usable localStorage the choice applies to the page, nothing breaks', async ({
    page,
  }) => {
    const fehler: string[] = [];
    page.on('pageerror', (e) => fehler.push(e.message));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('gesperrt');
        },
      });
    });
    await page.goto('/');
    expect(await dataTheme(page)).toBe('solarized-light');
    await page.getByLabel('Farbschema').selectOption('nord');
    expect(await dataTheme(page)).toBe('nord');
    expect(fehler).toEqual([]);
  });

  test('without JavaScript the switcher is hidden and the default applies', async ({
    browser,
  }) => {
    const ohne = await browser.newContext({ javaScriptEnabled: false });
    const seite = await ohne.newPage();
    await seite.goto('/');
    await expect(seite.locator('[data-theme-switch]')).toBeHidden();
    expect(await dataTheme(seite)).toBe('solarized-light');
    await ohne.close();
  });
});

test.describe('no flash', () => {
  test('the script is blocking, comes from the own domain and sits in the head', async ({
    request,
    page,
  }) => {
    await page.goto('/');
    const attrs = await page.evaluate(() => {
      const s = document.querySelector('head script[src="/theme-init.js"]');
      return s
        ? {
            async: s.hasAttribute('async'),
            defer: s.hasAttribute('defer'),
            module: s.getAttribute('type') === 'module',
          }
        : null;
    });
    expect(attrs).toEqual({ async: false, defer: false, module: false });
    const antwort = await request.get('/theme-init.js');
    expect(antwort.status()).toBe(200);
    expect(antwort.headers()['content-type']).toContain('javascript');
  });

  test('the stored choice is already set before any other script runs', async ({
    page,
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem('muffel:theme', 'dracula'),
    );
    // Everything except the theme script is blocked: only that one can have set it.
    await page.route('**/*.js', (route) =>
      route.request().url().endsWith('/theme-init.js')
        ? route.continue()
        : route.abort(),
    );
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(await dataTheme(page)).toBe('dracula');
    expect(await background(page)).toBe(THEMES.dracula);
  });
});

test.describe('Fonts and code', () => {
  test('Matrix uses IBM Plex Mono from the own domain', async ({
    page,
    baseURL,
  }) => {
    const origin = new URL(baseURL ?? 'http://localhost').origin;
    const foreign: string[] = [];
    page.on('request', (r) => {
      if (r.url().startsWith('http') && new URL(r.url()).origin !== origin)
        foreign.push(r.url());
    });
    await page.goto('/');
    await page.getByLabel('Farbschema').selectOption('matrix');
    await page.evaluate(() => document.fonts.ready);
    const geladen = await page.evaluate(async () => {
      await document.fonts.load('16px "IBM Plex Mono"');
      return document.fonts.check('16px "IBM Plex Mono"');
    });
    expect(geladen).toBe(true);
    expect(
      await page.evaluate(
        () =>
          getComputedStyle(document.querySelector('h1') as Element).fontFamily,
      ),
    ).toContain('IBM Plex Mono');
    expect(foreign).toEqual([]);
  });

  test('source code gets the colors of the chosen theme', async ({ page }) => {
    await page.goto('/p/rendering-demo/');
    const color = () =>
      page.evaluate(
        () =>
          getComputedStyle(document.querySelector('.hljs-keyword') as Element)
            .color,
      );
    expect(await color()).toBe('rgb(95, 112, 0)');
    await page.getByLabel('Farbschema').selectOption('dracula');
    expect(await color()).toBe('rgb(255, 121, 198)');
  });
});

test.describe('Layout', () => {
  test('pages have a header with navigation, also articles and memos', async ({
    page,
  }) => {
    for (const pfad of ['/', '/p/hallo-welt/', '/m/memo-text/', '/tag/']) {
      await page.goto(pfad);
      await expect(
        page.getByRole('navigation', { name: 'Hauptnavigation' }),
      ).toBeVisible();
    }
  });

  test('on a phone there is no horizontal scrolling', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 360, height: 740 },
    });
    const seite = await context.newPage();
    for (const pfad of ['/', '/p/rendering-demo/', '/tag/']) {
      await seite.goto(pfad);
      const breiter = await seite.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(breiter, pfad).toBe(false);
    }
    await context.close();
  });
});
