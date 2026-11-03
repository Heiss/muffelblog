import { describe, expect, it } from 'vitest';
import { canonicalUrl, restPages, sitemapXml } from './feed';

describe('restPages', () => {
  it('returns the pages from 2', () => {
    expect(restPages(45, 20)).toEqual([2, 3]);
    expect(restPages(20, 20)).toEqual([]);
    expect(restPages(0, 20)).toEqual([]);
  });
});

describe('sitemapXml', () => {
  it('builds absolute URLs and escapes special characters', () => {
    const xml = sitemapXml('https://example.org', [
      { path: '/', lastmod: new Date('2026-01-02T03:04:05Z') },
      { path: '/tag/a&b/' },
    ]);
    expect(xml).toContain('<loc>https://example.org/</loc>');
    expect(xml).toContain('<lastmod>2026-01-02</lastmod>');
    expect(xml).toContain('<loc>https://example.org/tag/a&amp;b/</loc>');
  });

  it('copes with a trailing slash on the base', () => {
    const xml = sitemapXml('https://example.org/', [{ path: '/x/' }]);
    expect(xml).toContain('<loc>https://example.org/x/</loc>');
  });

  it('rejects base addresses that are not http(s)', () => {
    expect(() => sitemapXml('ftp://example.org', [])).toThrow();
    expect(() => sitemapXml('example.org', [])).toThrow();
  });
});

describe('canonicalUrl', () => {
  it('puts the absolute address together from base and path', () => {
    expect(canonicalUrl('https://example.org/', '/p/a/')).toBe(
      'https://example.org/p/a/',
    );
  });

  it('returns nothing without a base', () => {
    expect(canonicalUrl(undefined, '/p/a/')).toBeUndefined();
  });
});
