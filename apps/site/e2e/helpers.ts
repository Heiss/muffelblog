import type { Page } from '@playwright/test';
import { catalogs } from '../src/i18n/catalogs.ts';

/** UI texts in the language the site under test was built with (`E2E_LANG`, default en). */
export const ui = catalogs[process.env.E2E_LANG === 'de' ? 'de' : 'en'];

// 1x1 PNG so the allowed foreign source does not have to go online in the test.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** Intercepts requests to foreign servers so they do not go online, and remembers them. */
export async function interceptForeign(page: Page): Promise<string[]> {
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
          : '<!doctype html><title>Foreign</title>',
    });
  });
  return gesehen;
}
