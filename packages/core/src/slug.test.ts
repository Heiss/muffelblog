import { describe, expect, it } from 'vitest';
import { normalizeTag, tagSlug, toSlug } from './slug.ts';

describe('toSlug', () => {
  it('schreibt klein und ersetzt Leerraum durch Bindestriche', () => {
    expect(toSlug('Hallo Welt')).toBe('hallo-welt');
  });

  it('transliteriert Umlaute und ß', () => {
    expect(toSlug('Größe und Maße')).toBe('groesse-und-masse');
    expect(toSlug('Äpfel Öl Übung')).toBe('aepfel-oel-uebung');
  });

  it('behandelt zerlegte Umlaute (macOS) wie zusammengesetzte', () => {
    expect(toSlug('Gro\u0308ße')).toBe('groesse');
    expect(toSlug('Gro\u0308ße')).toBe(toSlug('Größe'));
  });

  it('entfernt andere Akzente', () => {
    expect(toSlug('Café Señor')).toBe('cafe-senor');
  });

  it('fasst Sonderzeichen und Mehrfach-Bindestriche zusammen', () => {
    expect(toSlug('  A -- B / C!?  ')).toBe('a-b-c');
  });

  it('behält Ziffern', () => {
    expect(toSlug('Version 2.0')).toBe('version-2-0');
  });

  it('liefert null, wenn nichts Brauchbares übrig bleibt', () => {
    expect(toSlug('')).toBeNull();
    expect(toSlug('!!!')).toBeNull();
    expect(toSlug('日本語')).toBeNull();
  });
});

describe('normalizeTag', () => {
  it('schreibt klein, schneidet Leerraum ab und fasst Leerzeichen zusammen', () => {
    expect(normalizeTag('  Machine   Learning ')).toBe('machine learning');
  });

  it('behält Umlaute in der Anzeige', () => {
    expect(normalizeTag('Über Größe')).toBe('über größe');
  });

  it('entfernt ein führendes Rautenzeichen', () => {
    expect(normalizeTag('#Python')).toBe('python');
  });

  it('liefert null für leere Tags', () => {
    expect(normalizeTag('')).toBeNull();
    expect(normalizeTag('   ')).toBeNull();
    expect(normalizeTag('#')).toBeNull();
  });
});

describe('tagSlug', () => {
  it('ist die URL-Form des Tags', () => {
    expect(tagSlug('über größe')).toBe('ueber-groesse');
  });
});
