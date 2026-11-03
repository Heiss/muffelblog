import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Der Test-Build nutzt Blöcke zu 4 Einträgen (MUFFEL_FEED_PAGE_SIZE), die Beispieldaten
// haben 9 Artikel und 6 Memos.
// Die statische Struktur (Blöcke, Weiter-Links) wird ohne JavaScript geprüft;
// das Nachladen im Browser deckt feed-client.spec.ts ab.
test.use({ javaScriptEnabled: false });

const GESAMT = 15;
const BLOCK = 4;

interface Zeile {
  href: string;
  kind: string | null;
  datum: string;
}

async function zeilen(page: Page): Promise<Zeile[]> {
  return page.locator('article.eintrag').evaluateAll((els) =>
    els.map((el) => ({
      href: el.querySelector('h2 a')?.getAttribute('href') ?? '',
      kind: el.getAttribute('data-kind'),
      datum: el.querySelector('time')?.getAttribute('datetime') ?? '',
    })),
  );
}

/** Folgt "Ältere Einträge" bis zum Ende und sammelt alle Zeilen. */
async function alleSeiten(page: Page, start: string): Promise<Zeile[]> {
  const alle: Zeile[] = [];
  await page.goto(start);
  for (let i = 0; i < 20; i++) {
    alle.push(...(await zeilen(page)));
    const weiter = page.getByRole('link', { name: 'Ältere Einträge' });
    if ((await weiter.count()) === 0) return alle;
    await weiter.click();
  }
  throw new Error('Zu viele Seiten, Schleife?');
}

test.describe('Gemeinsamer Feed', () => {
  test('zeigt Artikel und Memos gemischt, neueste zuerst, ohne Doppelungen', async ({
    page,
  }) => {
    const alle = await alleSeiten(page, '/');
    expect(alle).toHaveLength(GESAMT);
    expect(new Set(alle.map((z) => z.href)).size).toBe(GESAMT);
    expect(new Set(alle.map((z) => z.kind))).toEqual(new Set(['post', 'memo']));
    const zeiten = alle.map((z) => Date.parse(z.datum));
    expect(zeiten).toEqual([...zeiten].sort((a, b) => b - a));
  });

  test('teilt in Blöcke und verlinkt vor und zurück', async ({ page }) => {
    await page.goto('/');
    expect(await zeilen(page)).toHaveLength(BLOCK);
    await expect(page.getByText('Seite 1 von 4')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Neuere Einträge' }),
    ).toHaveCount(0);

    await page.getByRole('link', { name: 'Ältere Einträge' }).click();
    await expect(page).toHaveURL(/\/seite\/2\/$/);
    await expect(page).toHaveTitle('Muffelblog, Seite 2 – Muffelblog');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, follow',
    );

    await page.getByRole('link', { name: 'Neuere Einträge' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });

  test('letzte Seite hat keinen Weiter-Link, eine fremde Seitenzahl gibt 404', async ({
    page,
    request,
  }) => {
    await page.goto('/seite/4/');
    expect(await zeilen(page)).toHaveLength(GESAMT - 3 * BLOCK);
    await expect(
      page.getByRole('link', { name: 'Ältere Einträge' }),
    ).toHaveCount(0);
    expect((await request.get('/seite/5/')).status()).toBe(404);
    expect((await request.get('/seite/1/')).status()).toBe(404);
  });

  test('Memos erscheinen vollständig, Artikel nur mit Auszug', async ({
    page,
  }) => {
    await page.goto('/');
    const memo = page.locator('article[data-kind="memo"]').first();
    await expect(memo.locator('.inhalt')).toBeVisible();
    const artikel = page.locator('article[data-kind="post"]').first();
    await expect(artikel.locator('.inhalt')).toHaveCount(0);
    await expect(artikel.locator('.auszug')).toBeVisible();
  });

  test('Titel führen zur eigenen Seite des Eintrags', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('link', { name: 'Memo vom 2. Nov. 2026, 14:32' })
      .click();
    await expect(page).toHaveURL(/\/m\/memo-text\/$/);
  });

  test('funktioniert ohne JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');
    await page.getByRole('link', { name: 'Ältere Einträge' }).click();
    await expect(page).toHaveURL(/\/seite\/2\/$/);
    await context.close();
  });

  test('lädt nichts von Fremddomains', async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? 'http://localhost').origin;
    const fremd: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.startsWith('http') && new URL(url).origin !== origin) {
        fremd.push(url);
      }
    });
    await alleSeiten(page, '/');
    expect(fremd).toEqual([]);
  });
});

test.describe('Filter nach Art', () => {
  test('/memos/ zeigt nur Memos, /posts/ nur Artikel, jeweils vollständig', async ({
    page,
  }) => {
    await page.goto('/memos/');
    await expect(page).toHaveTitle('Memos – Muffelblog');
    const memos = await alleSeiten(page, '/memos/');
    expect(memos.length).toBeGreaterThan(0);
    expect(memos.every((z) => z.kind === 'memo')).toBe(true);

    const posts = await alleSeiten(page, '/posts/');
    expect(posts.length).toBeGreaterThan(0);
    expect(posts.every((z) => z.kind === 'post')).toBe(true);
    expect(memos.length + posts.length).toBe(GESAMT);
  });
});

test.describe('Tags', () => {
  test('/tag/ listet alle Tags mit Anzahl', async ({ page }) => {
    await page.goto('/tag/');
    await expect(page).toHaveTitle('Tags – Muffelblog');
    const liste = page.getByRole('list', { name: 'Alle Tags' });
    await expect(liste.getByRole('link', { name: 'tooling' })).toHaveAttribute(
      'href',
      '/tag/tooling/',
    );
    // Verschachtelte Tags (a/b) haben eine URL-Form ohne Schrägstrich.
    await expect(liste.getByRole('link', { name: 'a/b' })).toHaveAttribute(
      'href',
      '/tag/a-b/',
    );
  });

  test('/tag/<tag>/ zeigt nur Einträge mit diesem Tag', async ({ page }) => {
    await page.goto('/tag/tooling/');
    await expect(page).toHaveTitle('Tag tooling – Muffelblog');
    const z = await zeilen(page);
    expect(z.map((e) => e.href)).toContain('/m/memo-text/');
    for (const eintrag of await page.locator('article.eintrag').all()) {
      await expect(
        eintrag.getByRole('link', { name: 'tooling', exact: true }),
      ).toBeVisible();
    }
  });

  test('Tag-Links im Eintrag führen zur Tag-Seite', async ({ page }) => {
    await page.goto('/memos/');
    await page
      .locator('article')
      .filter({ hasText: 'Renovate eingerichtet' })
      .getByRole('link', { name: 'tooling', exact: true })
      .click();
    await expect(page).toHaveURL(/\/tag\/tooling\/$/);
  });

  test('unbekannter Tag gibt 404', async ({ request }) => {
    expect((await request.get('/tag/gibt-es-nicht/')).status()).toBe(404);
  });
});

test('ohne SITE_URL gibt es keine Sitemap', async ({ request }) => {
  expect((await request.get('/sitemap.xml')).status()).toBe(404);
});
