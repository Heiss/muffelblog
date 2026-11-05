import { expect, test } from '@playwright/test';

test.describe('Icons', () => {
  test('every page names the icon and the touch icon, and both are served', async ({
    page,
    request,
  }) => {
    for (const url of ['/', '/p/hallo-welt/', '/glossary/']) {
      await page.goto(url);
      await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
        'href',
        '/favicon.svg',
      );
      await expect(
        page.locator('link[rel="apple-touch-icon"]'),
      ).toHaveAttribute('href', '/apple-touch-icon.png');
    }
    const svg = await request.get('/favicon.svg');
    expect(svg.status()).toBe(200);
    expect(svg.headers()['content-type']).toContain('image/svg+xml');
    const png = await request.get('/apple-touch-icon.png');
    expect(png.status()).toBe(200);
    expect(png.headers()['content-type']).toBe('image/png');
    const body = await png.body();
    expect(body.subarray(1, 4).toString('latin1')).toBe('PNG');
  });

  test('the icon is not a script carrier: no script, no foreign reference', async ({
    request,
  }) => {
    const text = await (await request.get('/favicon.svg')).text();
    expect(text).not.toMatch(/<script|onload|href=|xlink:/i);
  });
});
