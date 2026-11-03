import type { Page } from '@playwright/test';

// 1x1-PNG, damit die freigegebene Fremdquelle im Test nicht ins Netz muss.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** Fängt Anfragen an Fremdserver ab, damit sie nicht ins Netz gehen, und merkt sie sich. */
export async function fremdAbfangen(page: Page): Promise<string[]> {
  const gesehen: string[] = [];
  await page.route(/^https?:\/\/(?!localhost)/, (route) => {
    gesehen.push(route.request().url());
    return route.fulfill({
      status: 200,
      contentType:
        route.request().resourceType() === 'image' ? 'image/png' : 'text/html',
      body:
        route.request().resourceType() === 'image'
          ? PIXEL
          : '<!doctype html><title>Fremd</title>',
    });
  });
  return gesehen;
}
