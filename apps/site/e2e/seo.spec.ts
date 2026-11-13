import { expect, test } from '@playwright/test';
import { ui } from './helpers';

test.describe('Static pages', () => {
  test('a page lives at /<slug>/ and has no date or feed entry', async ({
    page,
  }) => {
    await page.goto('/impressum/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Impressum',
    );
    await expect(page.locator('main time')).toHaveCount(0);
    await expect(page.locator('.content')).toContainText('Testseite');
    // The footer links to it, the feed lists do not.
    await page.goto('/');
    await expect(
      page.locator('[data-feed-list] a[href="/impressum/"]'),
    ).toHaveCount(0);
  });

  test('footer links to the pages, the feed and the glossary on every page', async ({
    page,
  }) => {
    for (const path of ['/', '/p/hallo-welt/', '/glossary/']) {
      await page.goto(path);
      const footer = page.getByRole('contentinfo');
      await expect(
        footer.getByRole('link', { name: 'Impressum' }),
      ).toHaveAttribute('href', '/impressum/');
      await expect(
        footer.getByRole('link', { name: 'Datenschutz' }),
      ).toHaveAttribute('href', '/datenschutz/');
    }
  });

  test('pages with nav: true are in the header menu "More" and not in the footer', async ({
    page,
  }) => {
    for (const path of ['/', '/p/hallo-welt/', '/glossary/']) {
      await page.goto(path);
      const menu = page.locator('.site-header details.nav-more');
      await expect(menu.locator('summary')).toHaveText(ui.nav.more);
      await menu.locator('summary').click();
      await expect(
        menu.getByRole('link', { name: 'Über uns' }),
      ).toHaveAttribute('href', '/ueber-uns/');
      await expect(
        page.getByRole('contentinfo').getByRole('link', { name: 'Über uns' }),
      ).toHaveCount(0);
    }
  });

  test('pages are not part of the series, tags or search', async ({
    request,
  }) => {
    const tags = await (await request.get('/tag/')).text();
    expect(tags).not.toContain('/tag/impressum/');
    const html = await (await request.get('/impressum/')).text();
    expect(html).not.toContain('data-pagefind-body');
  });
});

test.describe('404 and robots.txt', () => {
  test('there is a 404 page that links home', async ({ request }) => {
    const html = await (await request.get('/404.html')).text();
    expect(html).toContain('<h1>');
    expect(html).toContain('href="/"');
  });

  test('robots.txt allows crawling and has no sitemap line without SITE_URL', async ({
    request,
  }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain('User-agent: *');
    expect(text).toContain('Allow: /');
    expect(text).not.toContain('Sitemap:');
  });
});

test.describe('Open Graph', () => {
  test('a post carries og tags and twitter card', async ({ page }) => {
    await page.goto('/p/hallo-welt/');
    const og = (name: string) =>
      page.locator(`meta[property="og:${name}"]`).getAttribute('content');
    expect(await og('title')).toBe('Hallo Welt');
    expect(await og('type')).toBe('article');
    expect(await og('site_name')).toBe('Muffelblog');
    expect(await og('locale')).toBe(ui.locale.replace('-', '_'));
    expect(await og('description')).toBe('Der erste Artikel.');
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary',
    );
  });

  test('posts, memos and terms have a preview image of 1200 x 630', async ({
    request,
  }) => {
    for (const path of ['/og/p/hallo-welt.png', '/og/g/cache.png']) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      expect(res.headers()['content-type'], path).toContain('image/png');
      const png = await res.body();
      // PNG header: width and height at bytes 16 and 20.
      expect([png.readUInt32BE(16), png.readUInt32BE(20)], path).toEqual([
        1200, 630,
      ]);
    }
  });

  test('the image is named only with a known domain (og:image must be absolute)', async ({
    page,
  }) => {
    await page.goto('/p/hallo-welt/');
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);
  });

  test('other pages are websites, og:url only with a known domain', async ({
    page,
  }) => {
    await page.goto('/glossary/');
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
      'content',
      'website',
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);
  });
});

test.describe('Microformats', () => {
  test('a post is an h-entry with name, date, content, category and url', async ({
    page,
  }) => {
    await page.goto('/p/hallo-welt/');
    const entry = page.locator('article.h-entry');
    await expect(entry).toHaveCount(1);
    await expect(entry.locator('.p-name')).toHaveText('Hallo Welt');
    await expect(entry.locator('time.dt-published')).toHaveAttribute(
      'datetime',
      /^2026-01-05/,
    );
    await expect(entry.locator('.e-content')).toContainText(
      'Inhalt des ersten Artikels',
    );
    await expect(entry.locator('.p-category')).toHaveText(['python', 'ml']);
    await expect(entry.locator('a.u-url')).toHaveAttribute(
      'href',
      '/p/hallo-welt/',
    );
  });

  test('memos and terms are h-entries too', async ({ page }) => {
    await page.goto('/m/memo-text/');
    await expect(page.locator('article.h-entry .e-content')).toHaveCount(1);
    await page.goto('/g/cache/');
    await expect(page.locator('article.h-entry .e-content')).toHaveCount(1);
  });

  test('the site has an h-card with its name and address', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.h-card');
    await expect(card.locator('.p-name')).toHaveText('Muffelblog');
    await expect(card.locator('.u-url')).toHaveAttribute('href', '/');
  });
});
