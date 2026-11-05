import { expect, test } from '@playwright/test';
import { ui } from './helpers';

test.describe('File tree', () => {
  test('shows the published files in their folders and links them', async ({
    page,
  }) => {
    await page.goto('/files/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      ui.files.title,
    );
    const tree = page.locator('main > .file-tree');
    await expect(
      tree.locator(':scope > .folder > details > summary').first(),
    ).toContainText('unterordner/');
    await page.getByRole('link', { name: 'tief.md' }).click();
    await expect(page).toHaveURL(/\/p\/[^/]+\/$/);
  });

  test('never shows drafts', async ({ request }) => {
    const html = await (await request.get('/files/')).text();
    expect(html).not.toContain('ohne-publish.md');
    expect(html).not.toContain('publish-string.md');
    expect(html).toContain('hallo-welt.md');
  });

  test('is in the main navigation and works without JavaScript', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');
    await page
      .getByRole('navigation', { name: ui.nav.label })
      .getByRole('link', { name: ui.nav.files })
      .click();
    await expect(page).toHaveURL(/\/files\/$/);
    await expect(page.getByRole('link', { name: 'cache.md' })).toBeVisible();
    await context.close();
  });
});
