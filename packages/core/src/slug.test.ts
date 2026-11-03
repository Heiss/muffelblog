import { describe, expect, it } from 'vitest';
import { normalizeTag, tagSlug, toSlug } from './slug.ts';

describe('toSlug', () => {
  it('lowercases and replaces whitespace with hyphens', () => {
    expect(toSlug('Hallo Welt')).toBe('hallo-welt');
  });

  it('transliterates umlauts and ß', () => {
    expect(toSlug('Größe und Maße')).toBe('groesse-und-masse');
    expect(toSlug('Äpfel Öl Übung')).toBe('aepfel-oel-uebung');
  });

  it('treats decomposed umlauts (macOS) like composed ones', () => {
    expect(toSlug('Gro\u0308ße')).toBe('groesse');
    expect(toSlug('Gro\u0308ße')).toBe(toSlug('Größe'));
  });

  it('removes other accents', () => {
    expect(toSlug('Café Señor')).toBe('cafe-senor');
  });

  it('collapses special characters and repeated hyphens', () => {
    expect(toSlug('  A -- B / C!?  ')).toBe('a-b-c');
  });

  it('keeps digits', () => {
    expect(toSlug('Version 2.0')).toBe('version-2-0');
  });

  it('returns null if nothing usable is left', () => {
    expect(toSlug('')).toBeNull();
    expect(toSlug('!!!')).toBeNull();
    expect(toSlug('日本語')).toBeNull();
  });
});

describe('normalizeTag', () => {
  it('lowercases, trims whitespace and collapses spaces', () => {
    expect(normalizeTag('  Machine   Learning ')).toBe('machine learning');
  });

  it('keeps umlauts in the display form', () => {
    expect(normalizeTag('Über Größe')).toBe('über größe');
  });

  it('removes a leading hash sign', () => {
    expect(normalizeTag('#Python')).toBe('python');
  });

  it('returns null for empty tags', () => {
    expect(normalizeTag('')).toBeNull();
    expect(normalizeTag('   ')).toBeNull();
    expect(normalizeTag('#')).toBeNull();
  });
});

describe('tagSlug', () => {
  it('is the URL form of the tag', () => {
    expect(tagSlug('über größe')).toBe('ueber-groesse');
  });
});
