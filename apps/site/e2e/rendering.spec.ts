import { expect, test } from '@playwright/test';
import { interceptForeign } from './helpers';

test.describe('Rendering demo (/p/rendering-demo/)', () => {
  test('renders Markdown with adjusted headings, list, table and code', async ({
    page,
  }) => {
    await interceptForeign(page);
    await page.goto('/p/rendering-demo/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Rendering-Demo',
    );
    await expect(page.locator('.content h2')).toHaveText('Abschnitt');
    await expect(page.locator('.content li')).toHaveText([
      'Punkt eins',
      'Punkt zwei',
    ]);
    await expect(page.locator('.content table td')).toHaveText(['a', '1']);
    await expect(page.locator('.content pre code.language-ts')).toContainText(
      'const x = 1;',
    );
    const link = page.getByRole('link', { name: 'externen Link' });
    await expect(link).toHaveAttribute('href', 'https://example.org/seite');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('serves local images as WebP in several widths from the own domain', async ({
    page,
    request,
  }) => {
    await interceptForeign(page);
    await page.goto('/p/rendering-demo/');
    const bild = page.locator('.content img[alt="Testbild"]');
    await expect(bild).toHaveAttribute(
      'srcset',
      /\/media\/[0-9a-f]{16}-480\.webp 480w, \/media\/[0-9a-f]{16}-960\.webp 960w/,
    );
    await expect(bild).toHaveAttribute('width', '960');
    await expect(bild).toHaveAttribute('height', '480');
    await expect(bild).toHaveAttribute('loading', 'lazy');
    const src = await bild.getAttribute('src');
    expect(src).toMatch(/^\/media\/[0-9a-f]{16}-960\.webp$/);
    const antwort = await request.get(src ?? '');
    expect(antwort.status()).toBe(200);
    expect(antwort.headers()['content-type']).toBe('image/webp');
    const koerper = await antwort.body();
    expect(koerper.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(koerper.subarray(8, 12).toString('latin1')).toBe('WEBP');
  });

  test('loads allowed remote images, removes others and reports missing ones', async ({
    page,
  }) => {
    const foreign = await interceptForeign(page);
    await page.goto('/p/rendering-demo/');
    await page.waitForLoadState('networkidle');

    const wiki = page.locator('.content img[alt="Wikimedia"]');
    await expect(wiki).toHaveAttribute(
      'src',
      'https://upload.wikimedia.org/wikipedia/commons/a/a9/Example.jpg',
    );
    await expect(wiki).toHaveAttribute('referrerpolicy', 'no-referrer');

    await expect(page.locator('.content img[alt="Tracker"]')).toHaveCount(0);
    expect(foreign.filter((u) => u.includes('tracker.example'))).toEqual([]);
    expect(foreign).toEqual([
      'https://upload.wikimedia.org/wikipedia/commons/a/a9/Example.jpg',
    ]);

    await expect(page.locator('.content .image-missing')).toHaveText(
      '[Image missing: Fehlt]',
    );
  });

  test('loads embeds only after the click', async ({ page }) => {
    const foreign = await interceptForeign(page);
    await page.goto('/p/rendering-demo/');
    await page.waitForLoadState('networkidle');

    const platzhalter = page.locator('.content .embed');
    await expect(platzhalter).toContainText('YouTube');
    await expect(page.locator('.content iframe')).toHaveCount(0);
    expect(foreign.filter((u) => u.includes('youtube'))).toEqual([]);
    await expect(
      page.getByRole('link', { name: 'Open on YouTube' }),
    ).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

    await page.getByRole('button', { name: 'Load content' }).click();
    const frame = page.locator('.content iframe');
    await expect(frame).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    );
    await expect(frame).toHaveAttribute(
      'sandbox',
      'allow-scripts allow-same-origin allow-presentation',
    );
    await expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer');
    await expect
      .poll(() =>
        foreign.some((u) => u.startsWith('https://www.youtube-nocookie.com/')),
      )
      .toBe(true);
  });
});

test.describe('Unsafe content (/p/unsicher/)', () => {
  test('executes nothing and loads nothing from foreign servers', async ({
    page,
  }) => {
    const foreign = await interceptForeign(page);
    await page.goto('/p/unsicher/');
    await page.waitForLoadState('networkidle');

    expect(
      await page.evaluate(
        () => (window as unknown as { __pwned?: number }).__pwned,
      ),
    ).toBeUndefined();
    await expect(page.locator('.content script')).toHaveCount(0);
    await expect(page.locator('.content iframe')).toHaveCount(0);
    await expect(page.locator('.content form')).toHaveCount(0);
    await expect(page.locator('.content [onerror]')).toHaveCount(0);

    const verweis = page.getByText('Gefährlicher Link');
    await expect(verweis).toBeVisible();
    expect(
      await page.locator('.content a[href^="javascript:" i]').count(),
    ).toBe(0);

    await expect(page.locator('.content')).toContainText('Text vorher.');
    await expect(page.locator('.content')).toContainText('Text nachher.');
    expect(foreign).toEqual([]);
  });
});
