import { describe, expect, it } from 'vitest';
import type { FeedItem } from '@muffelblog/core';
import { canonicalUrl, latestUpdate, restPages, sitemapXml } from './feed';

describe('restPages', () => {
  it('returns the pages from 2', () => {
    expect(restPages(45, 20)).toEqual([2, 3]);
    expect(restPages(20, 20)).toEqual([]);
    expect(restPages(0, 20)).toEqual([]);
  });
});

describe('latestUpdate', () => {
  const item = (updated: string): FeedItem => ({
    kind: 'post',
    id: `post:${updated}`,
    url: '/p/x/',
    title: 'x',
    created: new Date('2026-01-01T00:00:00Z'),
    updated: new Date(updated),
    tags: [],
    excerpt: '',
  });

  it('is the newest updated date, not the order of the list', () => {
    expect(
      latestUpdate([
        item('2026-02-01T00:00:00Z'),
        item('2026-05-01T00:00:00Z'),
        item('2026-03-01T00:00:00Z'),
      ]),
    ).toEqual(new Date('2026-05-01T00:00:00Z'));
  });

  it('is undefined for an empty list', () => {
    expect(latestUpdate([])).toBeUndefined();
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
