import { expect, test } from '@playwright/test';
import { ui } from './helpers';

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
      section.getByRole('heading', { name: ui.comments.title }),
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

  test('pages, the feed and search have no comments', async ({ request }) => {
    for (const path of ['/impressum/', '/', '/glossary/', '/search/']) {
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

test.describe('Static copy of the comments', () => {
  test('is in the HTML and readable without JavaScript', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/p/hallo-welt/');
    const copy = page.locator('#comments [data-comments-static]');
    await expect(copy).toBeVisible();
    await expect(copy.locator('.comment-author').first()).toHaveText('Anna');
    await expect(copy).toContainText('Schöner erster Beitrag');
    await context.close();
  });

  test('shows replies below their comment and in time order', async ({
    request,
  }) => {
    const html = await (await request.get('/p/hallo-welt/')).text();
    const anna = html.indexOf('Schöner erster Beitrag');
    const reply = html.indexOf('Gern geschehen');
    const mallory = html.indexOf('Böse');
    expect(anna).toBeGreaterThan(-1);
    expect(reply).toBeGreaterThan(anna);
    expect(mallory).toBeGreaterThan(reply);
    // The reply sits in a nested list.
    expect(html).toMatch(
      /Schöner erster Beitrag[\s\S]*<ol class="comment-list[^>]*>[\s\S]*Gern geschehen/,
    );
  });

  test('is sanitized: no script, no foreign image, no javascript link, author as text', async ({
    request,
  }) => {
    const html = await (await request.get('/p/hallo-welt/')).text();
    const section = html.slice(html.indexOf('data-comments-static'));
    expect(section).not.toContain("alert('x')");
    expect(section).not.toContain('evil.example');
    expect(section).not.toContain('javascript:');
    expect(section).toContain('&lt;b&gt;Mallory&lt;/b&gt;');
    expect(section).toContain('rel="noopener noreferrer"');
  });

  test('a deleted comment is gone', async ({ request }) => {
    const html = await (await request.get('/p/hallo-welt/')).text();
    expect(html).not.toContain('geheim');
  });

  test('memos have their copy, pages without comments have none', async ({
    request,
  }) => {
    expect(await (await request.get('/m/memo-text/')).text()).toContain(
      'Memo-Kommentar',
    );
    expect(await (await request.get('/m/memo-bild/')).text()).not.toContain(
      'data-comments-static',
    );
  });

  test('steps aside when the widget has loaded', async ({ page }) => {
    await page.route('http://localhost:4322/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: '',
      }),
    );
    await page.goto('/p/hallo-welt/');
    await expect(page.locator('#comments [data-comments-static]')).toBeHidden();
  });

  test('stays when the widget cannot be loaded', async ({ page }) => {
    await page.route('http://localhost:4322/**', (route) => route.abort());
    await page.goto('/p/hallo-welt/');
    await expect(
      page.locator('#comments [data-comments-static]'),
    ).toBeVisible();
    await expect(page.locator('#comments [data-comments-error]')).toBeVisible();
  });
});

test.describe('New comments (/comments/)', () => {
  test('lists all comments of the site as one list, newest first, deleted ones left out', async ({
    page,
  }) => {
    await page.goto('/comments/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      ui.recentComments.title,
    );
    const authors = page.locator('.comment-entry .comment-author');
    // Fixture times: Carla (memo, Nov), Mallory (7 Jan), Bernd (reply, 6 Jan), Anna (6 Jan).
    await expect(authors).toHaveText([
      'Carla',
      '<b>Mallory</b>',
      'Bernd',
      'Anna',
    ]);
    const html = await page.content();
    expect(html).not.toContain('Weg');
    expect(html).not.toContain("alert('x')");
    expect(html).not.toContain('evil.example');
  });

  test('a reply names what it answers, and every entry links to its comment on the page', async ({
    page,
  }) => {
    await page.goto('/comments/');
    const reply = page.locator('.comment-entry', { hasText: 'Bernd' });
    await expect(reply.locator('.comment-reply')).toContainText(
      ui.recentComments.replyTo('Anna'),
    );
    await expect(reply.locator('.comment-reply q')).toContainText(
      'Schöner erster Beitrag',
    );
    await expect(
      reply.getByRole('link', { name: ui.recentComments.jump }),
    ).toHaveAttribute('href', '/p/hallo-welt/#remark42__comment-c2');
    await expect(reply.locator('a[href="/p/hallo-welt/"]')).toBeVisible();
    const memo = page.locator('.comment-entry', { hasText: 'Carla' });
    await expect(
      memo.getByRole('link', { name: ui.recentComments.jump }),
    ).toHaveAttribute('href', '/m/memo-text/#remark42__comment-c5');
  });

  test('the page has the target of the link for visitors without the widget, and the menu links here', async ({
    page,
  }) => {
    await page.goto('/p/hallo-welt/');
    await expect(page.locator('#remark42__comment-c2')).toHaveCount(1);
    await expect(
      page
        .getByRole('navigation', { name: ui.nav.label })
        .getByRole('link', { name: ui.nav.comments }),
    ).toHaveAttribute('href', '/comments/');
  });
});
