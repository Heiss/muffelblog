import { expect, test } from '@playwright/test';
import { ui } from './helpers';

test.describe('Glossary', () => {
  test('term page lives under /g/<slug>/ and is marked as a term', async ({
    page,
  }) => {
    await page.goto('/g/cache/');
    // The title is a question; the term (`term: Cache`) is used in the letter view.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Was ist ein Cache?',
    );
    await expect(page.locator('.kind')).toHaveText(ui.glossary.term);
    await expect(page.locator('.content')).toContainText(
      'hält Ergebnisse bereit',
    );
    await expect(page).toHaveTitle('Was ist ein Cache? – Muffelblog');
  });

  test('a post and a term can share a slug', async ({ page }) => {
    const post = await page.goto('/p/hallo-welt/');
    expect(post?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Hallo Welt',
    );
    const term = await page.goto('/g/hallo-welt/');
    expect(term?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Hallo Welt (Begriff)',
    );
  });

  test('a term is not served under /p/ and a post not under /g/', async ({
    request,
  }) => {
    expect((await request.get('/p/cache/')).status()).toBe(404);
    expect((await request.get('/g/rendering-demo/')).status()).toBe(404);
  });

  test('letter view groups by letter, umlauts under the base letter', async ({
    page,
  }) => {
    await page.goto('/glossary/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      ui.glossary.title,
    );
    const bar = page.getByRole('navigation', {
      name: ui.glossary.lettersLabel,
    });
    await expect(bar.getByRole('link')).toHaveText(['A', 'C', 'H']);
    await expect(page.locator('#letter-A + ul a')).toHaveText(['Äther']);
    await expect(page.locator('#letter-C + ul a')).toHaveText(['Cache']);
  });

  test('letter bar is made of real links that jump to the letter', async ({
    page,
  }) => {
    await page.goto('/glossary/');
    await page
      .getByRole('navigation', { name: ui.glossary.lettersLabel })
      .getByRole('link', { name: 'C' })
      .click();
    await expect(page).toHaveURL(/#letter-C$/);
  });

  test('the Begriffe series lists only terms', async ({ page }) => {
    await page.goto('/terms/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      ui.filter.terms,
    );
    const kinds = await page
      .locator('[data-feed-list] article')
      .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.kind));
    expect(kinds.length).toBe(3);
    expect(new Set(kinds)).toEqual(new Set(['glossary']));
  });

  test('Lang never contains terms, Alle shows them marked', async ({
    browser,
  }) => {
    // Without JavaScript every page shows exactly its own static block.
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/posts/');
    await expect(page.locator('[data-kind="glossary"]')).toHaveCount(0);
    const all = await (async () => {
      const kinds: (string | null)[] = [];
      for (let n = 1; n <= 5; n++) {
        await page.goto(n === 1 ? '/' : `/page/${n}/`);
        kinds.push(
          ...(await page
            .locator('article.entry')
            .evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')))),
        );
        const marked = await page
          .locator('[data-kind="glossary"] .kind')
          .allTextContents();
        expect(marked.every((t) => t === ui.glossary.term)).toBe(true);
      }
      return kinds;
    })();
    expect(all.filter((k) => k === 'glossary')).toHaveLength(3);
    await context.close();
  });

  test('filter shows Begriffe with its series', async ({ page }) => {
    await page.goto('/');
    const filter = page.getByRole('navigation', { name: ui.filter.label });
    await expect(filter.getByRole('link')).toHaveText([
      ui.filter.all,
      ui.filter.long,
      ui.filter.short,
      ui.filter.terms,
    ]);
    await filter.getByRole('link', { name: ui.filter.terms }).click();
    await expect(
      page.locator('[data-feed-list] article[data-kind="post"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-feed-list] article[data-kind="glossary"]'),
    ).toHaveCount(3);
  });

  test('a term has a comment section', async ({ page }) => {
    await page.route('http://localhost:4322/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: '',
      }),
    );
    await page.goto('/g/cache/');
    await expect(
      page.locator('#comments').getByRole('heading', {
        name: ui.comments.title,
      }),
    ).toBeVisible();
  });

  test('works without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/glossary/');
    await expect(page.locator('#letter-C + ul a')).toHaveText(['Cache']);
    await page.getByRole('link', { name: 'Cache' }).click();
    await expect(page).toHaveURL(/\/g\/cache\/$/);
    await context.close();
  });
});
