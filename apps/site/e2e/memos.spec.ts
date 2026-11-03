import { expect, test } from '@playwright/test';
import { interceptForeign } from './helpers';

test.describe('Memo pages under /m/<uid>/', () => {
  test('shows title from date and time, instant, tags and text', async ({
    page,
  }) => {
    await page.goto('/m/memo-text/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page).toHaveTitle('Memo vom 2. Nov. 2026, 14:32 – Muffelblog');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Memo vom 2. Nov. 2026, 14:32',
    );
    await expect(page.locator('h1 time')).toHaveAttribute(
      'datetime',
      '2026-11-02T13:32:00.000Z',
    );
    await expect(
      page.getByRole('list', { name: 'Tags' }).getByRole('listitem'),
    ).toHaveText(['tooling', 'a/b']);
    await expect(page.locator('.content')).toContainText(
      'Renovate eingerichtet.',
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /^Renovate eingerichtet\. Patch-Updates mergen jetzt von allein\./,
    );
  });

  test('shows mirrored images from the own domain with alt text from the file name', async ({
    page,
    request,
  }) => {
    const foreign = await interceptForeign(page);
    await page.goto('/m/memo-bild/');
    await page.waitForLoadState('networkidle');
    const bild = page.locator('.content img');
    await expect(bild).toHaveAttribute('alt', 'IMG 2043');
    await expect(bild).toHaveAttribute(
      'srcset',
      /\/media\/[0-9a-f]{16}-480\.webp 480w, \/media\/[0-9a-f]{16}-960\.webp 960w/,
    );
    expect(
      await bild.evaluate(
        (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
      ),
    ).toBe(true);
    const antwort = await request.get((await bild.getAttribute('src')) ?? '');
    expect(antwort.headers()['content-type']).toBe('image/webp');
    expect(foreign).toEqual([]);
  });

  test('serves PDF and audio with a fitting content type from the own domain', async ({
    page,
    request,
  }) => {
    await page.goto('/m/memo-dateien/');
    const pdf = page.getByRole('link', { name: 'Mein Bericht.pdf' });
    await expect(pdf).toHaveAttribute(
      'href',
      /^\/media\/[0-9a-f]{16}-mein-bericht\.pdf$/,
    );
    const pdfAntwort = await request.get(
      (await pdf.getAttribute('href')) ?? '',
    );
    expect(pdfAntwort.status()).toBe(200);
    expect(pdfAntwort.headers()['content-type']).toBe('application/pdf');

    const audio = page.locator('.content audio');
    await expect(audio).toHaveAttribute('preload', 'none');
    await expect(audio).toHaveAttribute(
      'src',
      /^\/media\/[0-9a-f]{16}-klang\.wav$/,
    );
    const audioAntwort = await request.get(
      (await audio.getAttribute('src')) ?? '',
    );
    expect(audioAntwort.headers()['content-type']).toBe('audio/wav');
  });

  test('sanitizes the text and loads no images from foreign servers', async ({
    page,
  }) => {
    const foreign = await interceptForeign(page);
    await page.goto('/m/memo-skript/');
    await page.waitForLoadState('networkidle');
    expect(
      await page.evaluate(
        () => (window as unknown as { __pwned?: number }).__pwned,
      ),
    ).toBeUndefined();
    await expect(page.locator('.content script')).toHaveCount(0);
    await expect(page.locator('.content img')).toHaveCount(0);
    await expect(page.locator('.content')).toContainText('Harmloser Text.');
    expect(foreign).toEqual([]);
  });

  test('leaves out external and disallowed attachments but shows the memo', async ({
    page,
  }) => {
    await page.goto('/m/memo-extern/');
    await expect(page.locator('.content')).toContainText(
      'Anhang liegt extern.',
    );
    expect(await page.content()).not.toContain('s3.example');
    await page.goto('/m/memo-html/');
    await expect(page.locator('.content')).toContainText(
      'Anhang mit unerlaubtem Typ.',
    );
    expect(await page.content()).not.toContain('seite.html');
  });

  test('does not publish private memos', async ({ request }) => {
    expect((await request.get('/m/memo-privat/')).status()).toBe(404);
  });

  test('serves no media files of an unknown or active type', async ({
    request,
  }) => {
    for (const pfad of [
      '/media/seite.html',
      '/media/logo.svg',
      '/media/x.js',
    ]) {
      expect((await request.get(pfad)).status()).toBe(404);
    }
  });
});
