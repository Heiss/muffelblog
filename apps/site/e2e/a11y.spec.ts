import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { THEMES } from '../src/lib/themes';

// Automated accessibility check (axe, WCAG 2.1 A and AA). It finds a part of the
// problems (about a third, by the estimate of its makers): it does not replace
// a look with a screen reader and the keyboard.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} [${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(' | ')}]`,
  );
}

const PAGES = [
  '/',
  '/p/hallo-welt/',
  '/memos/',
  '/glossary/',
  '/g/cache/',
  '/search/',
  '/tag/',
  '/impressum/',
];

test.describe('Accessibility (axe)', () => {
  test('the check itself finds problems (so a pass means something)', async ({
    page,
  }) => {
    await page.setContent(
      '<!doctype html><html><body><img src="x.png"><button></button></body></html>',
    );
    const found = (await violations(page)).join('\n');
    expect(found).toContain('image-alt');
    expect(found).toContain('button-name');
    expect(found).toContain('document-title');
    expect(found).toContain('html-has-lang');
  });

  for (const url of PAGES) {
    test(`${url} has no violations`, async ({ page }) => {
      await page.goto(url);
      expect(await violations(page)).toEqual([]);
    });
  }

  test('the 404 page has no violations', async ({ page }) => {
    await page.goto('/404.html');
    expect(await violations(page)).toEqual([]);
  });

  for (const theme of THEMES) {
    test(`the feed has no violations in the theme ${theme.id}`, async ({
      page,
    }) => {
      await page.addInitScript(
        ([key, id]) => localStorage.setItem(key as string, id as string),
        ['muffel:theme', theme.id],
      );
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute(
        'data-theme',
        theme.id,
      );
      expect(await violations(page)).toEqual([]);
    });
  }
});
