import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Test-Build: Blöcke zu 4 Einträgen, 9 Artikel und 6 Memos, also 4 Blöcke gemischt.
const GESAMT = 15;
const MEMOS = 6;
const POSTS = 9;

const eintraege = (page: Page) => page.locator('[data-feed-liste] > article');

async function ids(page: Page): Promise<string[]> {
  return eintraege(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-id') ?? ''),
  );
}

async function ganzNachUnten(page: Page, erwartet: number): Promise<void> {
  await expect
    .poll(
      async () => {
        await page.evaluate(() =>
          window.scrollTo(0, document.documentElement.scrollHeight),
        );
        return eintraege(page).count();
      },
      { timeout: 15_000 },
    )
    .toBe(erwartet);
}

test.describe('Endless Scroll', () => {
  test('lädt beim Scrollen alle Blöcke nach, ohne Doppelungen', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(eintraege(page)).toHaveCount(4);
    await ganzNachUnten(page, GESAMT);
    const alle = await ids(page);
    expect(new Set(alle).size).toBe(GESAMT);
    // Am Ende gibt es keinen sichtbaren Weiter-Link und keine Fehlermeldung mehr.
    await expect(
      page.getByRole('link', { name: 'Ältere Einträge' }),
    ).toBeHidden();
    await expect(page.locator('[data-feed-status]')).toBeHidden();
  });

  test('behält die Reihenfolge: neueste zuerst über alle Blöcke', async ({
    page,
  }) => {
    await page.goto('/');
    await ganzNachUnten(page, GESAMT);
    const zeiten = await page
      .locator('[data-feed-liste] > article time')
      .evaluateAll((els) =>
        els.map((el) => Date.parse(el.getAttribute('datetime') ?? '')),
      );
    expect(zeiten).toEqual([...zeiten].sort((a, b) => b - a));
  });

  test('der Weiter-Link ist mit JavaScript verborgen, ohne bleibt er sichtbar', async ({
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

  test('bei einem Ladefehler erscheint ein Hinweis und der Link bleibt benutzbar', async ({
    page,
  }) => {
    await page.route('**/seite/2/', (route) => route.abort());
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
    await expect(eintraege(page)).toHaveCount(4);
  });

  test('lädt auf Tag-Seiten nach, ohne dass es dort einen Filter gibt', async ({
    page,
  }) => {
    await page.goto('/tag/tooling/');
    await expect(page.getByRole('navigation', { name: 'Filter' })).toHaveCount(
      0,
    );
    const erste = await eintraege(page).count();
    expect(erste).toBeGreaterThan(0);
  });
});

test.describe('Filter im Unified-Modus', () => {
  test('Kurz zeigt nur Memos, behält die Adresse sauber und lädt nach', async ({
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
    await ganzNachUnten(page, MEMOS);
    expect((await ids(page)).every((id) => id.startsWith('memo:'))).toBe(true);
  });

  test('Lang und Alle wechseln zurück', async ({ page }) => {
    await page.goto('/');
    const filter = page.getByRole('navigation', { name: 'Filter' });
    await filter.getByRole('link', { name: 'Lang' }).click();
    await ganzNachUnten(page, POSTS);
    expect((await ids(page)).every((id) => id.startsWith('post:'))).toBe(true);
    await filter.getByRole('link', { name: 'Alle' }).click();
    await expect(page).toHaveURL(/\/$/);
    await ganzNachUnten(page, GESAMT);
  });

  test('ein Wechsel startet oben und ohne Reste der alten Liste', async ({
    page,
  }) => {
    await page.goto('/');
    await ganzNachUnten(page, GESAMT);
    const filter = page.getByRole('navigation', { name: 'Filter' });
    await filter.getByRole('link', { name: 'Kurz' }).click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(
      page.locator('[data-feed-liste] > article[data-kind="post"]'),
    ).toHaveCount(0);
  });

  test('der Filter bleibt nach dem Neuladen von / erhalten', async ({
    page,
  }) => {
    await page.goto('/');
    const filter = page.getByRole('navigation', { name: 'Filter' });
    await filter.getByRole('link', { name: 'Kurz' }).click();
    await expect(page).toHaveURL(/\/memos\/$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/memos\/$/);
    await expect(
      page.locator('[data-feed-liste] > article[data-kind="post"]'),
    ).toHaveCount(0);
    await filter.getByRole('link', { name: 'Alle' }).click();
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
  });

  test('eine ausdrücklich aufgerufene Reihe gewinnt gegen den gespeicherten Filter', async ({
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

  test('ohne nutzbaren localStorage gelten die Standardwerte und alles funktioniert', async ({
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
    await expect(eintraege(page)).toHaveCount(4);
    await page
      .getByRole('navigation', { name: 'Filter' })
      .getByRole('link', { name: 'Kurz' })
      .click();
    await ganzNachUnten(page, MEMOS);
  });

  test('ohne JavaScript sind die Filter normale Links', async ({ browser }) => {
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

test.describe('Rücksprung', () => {
  test('stellt geladene Blöcke und Scrollposition wieder her', async ({
    page,
  }) => {
    await page.goto('/');
    await ganzNachUnten(page, GESAMT);
    const eintrag = eintraege(page).nth(10);
    await eintrag.scrollIntoViewIfNeeded();
    const vorher = await page.evaluate(() => window.scrollY);
    const href = await eintrag.locator('h2 a').getAttribute('href');
    await eintrag.locator('h2 a').click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await page.goBack();
    await expect(eintraege(page)).toHaveCount(GESAMT);
    await expect
      .poll(async () =>
        Math.abs((await page.evaluate(() => window.scrollY)) - vorher),
      )
      .toBeLessThan(150);
  });
});

test('Nachladen bleibt bei der eigenen Herkunft', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? 'http://localhost').origin;
  const fremd: string[] = [];
  page.on('request', (r) => {
    if (r.url().startsWith('http') && new URL(r.url()).origin !== origin)
      fremd.push(r.url());
  });
  await page.goto('/');
  await ganzNachUnten(page, GESAMT);
  expect(fremd).toEqual([]);
});
