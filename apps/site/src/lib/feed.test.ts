import { describe, expect, it } from 'vitest';
import { canonicalUrl, pageSize, restSeiten, sitemapXml } from './feed';

describe('pageSize', () => {
  it('nimmt 20, auch wenn eine Größe gesetzt ist, solange keine Beispieldaten laufen', () => {
    expect(pageSize({})).toBe(20);
    expect(pageSize({ MUFFEL_PAGE_SIZE: '3' })).toBe(20);
  });

  it('erlaubt eine kleinere Größe nur mit Beispieldaten', () => {
    expect(pageSize({ MUFFEL_FIXTURES: '1', MUFFEL_PAGE_SIZE: '3' })).toBe(3);
  });

  it('weist ungültige Größen ab', () => {
    for (const wert of ['0', '-1', '2.5', 'abc', '']) {
      expect(pageSize({ MUFFEL_FIXTURES: '1', MUFFEL_PAGE_SIZE: wert })).toBe(
        20,
      );
    }
  });
});

describe('restSeiten', () => {
  it('liefert die Seiten ab 2', () => {
    expect(restSeiten(45, 20)).toEqual([2, 3]);
    expect(restSeiten(20, 20)).toEqual([]);
    expect(restSeiten(0, 20)).toEqual([]);
  });
});

describe('sitemapXml', () => {
  it('bildet absolute URLs und maskiert Sonderzeichen', () => {
    const xml = sitemapXml('https://example.org', [
      { path: '/', lastmod: new Date('2026-01-02T03:04:05Z') },
      { path: '/tag/a&b/' },
    ]);
    expect(xml).toContain('<loc>https://example.org/</loc>');
    expect(xml).toContain('<lastmod>2026-01-02</lastmod>');
    expect(xml).toContain('<loc>https://example.org/tag/a&amp;b/</loc>');
  });

  it('verträgt einen Schrägstrich am Ende der Basis', () => {
    const xml = sitemapXml('https://example.org/', [{ path: '/x/' }]);
    expect(xml).toContain('<loc>https://example.org/x/</loc>');
  });

  it('lehnt Basis-Adressen ab, die kein http(s) sind', () => {
    expect(() => sitemapXml('ftp://example.org', [])).toThrow();
    expect(() => sitemapXml('example.org', [])).toThrow();
  });
});

describe('canonicalUrl', () => {
  it('setzt die absolute Adresse aus Basis und Pfad zusammen', () => {
    expect(canonicalUrl('https://example.org/', '/p/a/')).toBe(
      'https://example.org/p/a/',
    );
  });

  it('liefert ohne Basis nichts', () => {
    expect(canonicalUrl(undefined, '/p/a/')).toBeUndefined();
  });
});
