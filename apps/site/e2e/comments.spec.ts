import { expect, test } from '@playwright/test';

// The test build sets COMMENTS_URL=http://localhost:4322 (nothing listens
// there); the widget script is answered by the test.
const HOST = 'http://localhost:4322';

const MOCK_EMBED = `
  window.__remark = JSON.parse(JSON.stringify(window.remark_config || null));
  document.getElementById('remark42').setAttribute('data-mock', 'loaded');
`;

test.describe('Comments', () => {
  test('a post has a comment section that loads the widget from the comments host', async ({
    page,
  }) => {
    const requested: string[] = [];
    await page.route(`${HOST}/**`, (route) => {
      requested.push(route.request().url());
      return route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: MOCK_EMBED,
      });
    });
    await page.goto('/p/hallo-welt/');
    const section = page.locator('#comments');
    await expect(
      section.getByRole('heading', { name: 'Kommentare' }),
    ).toBeVisible();
    await expect(page.locator('#remark42')).toHaveAttribute(
      'data-mock',
      'loaded',
    );
    expect(requested).toEqual([`${HOST}/web/embed.js`]);
    const config = await page.evaluate(
      () =>
        (window as unknown as { __remark: Record<string, unknown> }).__remark,
    );
    expect(config).toMatchObject({
      host: HOST,
      site_id: 'muffelblog',
      components: ['embed'],
    });
    expect(String(config.url)).toMatch(/\/p\/hallo-welt\/$/);
  });

  test('memos have comments too', async ({ page }) => {
    await page.route(`${HOST}/**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: MOCK_EMBED,
      }),
    );
    await page.goto('/m/memo-text/');
    await expect(page.locator('#remark42')).toHaveAttribute(
      'data-mock',
      'loaded',
    );
  });

  test('terms, pages, the feed and search have no comments', async ({
    request,
  }) => {
    for (const path of [
      '/g/cache/',
      '/impressum/',
      '/',
      '/glossary/',
      '/search/',
    ]) {
      const html = await (await request.get(path)).text();
      expect(html, path).not.toContain('id="comments"');
    }
  });

  test('the comment section is not part of the search index', async ({
    request,
  }) => {
    const html = await (await request.get('/p/hallo-welt/')).text();
    expect(html).toMatch(/<section[^>]*id="comments"[^>]*data-pagefind-ignore/);
  });

  test('says that JavaScript is needed when it is off', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/p/hallo-welt/');
    await expect(page.locator('#comments')).toContainText('JavaScript');
    await context.close();
  });

  test('a failing widget leaves a visible hint', async ({ page }) => {
    await page.route(`${HOST}/**`, (route) => route.abort());
    await page.goto('/p/hallo-welt/');
    await expect(page.locator('#comments [data-comments-error]')).toBeVisible();
  });
});
