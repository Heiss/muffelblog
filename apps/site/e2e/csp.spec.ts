import { expect, test } from '@playwright/test';

// The Caddyfile sets script-src 'self' and style-src 'self' without
// 'unsafe-inline'. So no page may carry inline scripts, inline styles or
// style attributes (the policy itself is checked in packages/core/src/csp.test.ts).
const PAGES = [
  '/',
  '/page/2/',
  '/posts/',
  '/p/hallo-welt/',
  '/m/memo-text/',
  '/g/cache/',
  '/glossary/',
  '/search/',
  '/tag/',
  '/impressum/',
  '/404.html',
];

test.describe('Pages are compatible with the strict CSP', () => {
  for (const path of PAGES) {
    test(`no inline code on ${path}`, async ({ request }) => {
      const html = await (await request.get(path)).text();
      const inlineScripts = html.match(/<script(?![^>]*\ssrc=)[^>]*>/g) ?? [];
      expect(inlineScripts, 'inline <script>').toEqual([]);
      expect(html.match(/<style[\s>]/g) ?? [], 'inline <style>').toEqual([]);
      expect(html.match(/\sstyle="/g) ?? [], 'style attributes').toEqual([]);
      expect(
        html.match(/\son[a-z]+="/g) ?? [],
        'event handler attributes',
      ).toEqual([]);
    });
  }
});
