import { describe, expect, it } from 'vitest';
import { SITE_LANG, SITE_NAME, pageTitle } from './index.ts';

describe('pageTitle', () => {
  it('liefert den Seitennamen, wenn kein Titel gegeben ist', () => {
    expect(pageTitle()).toBe(SITE_NAME);
  });

  it('hängt den Seitennamen an einen Titel an', () => {
    expect(pageTitle('Hallo Welt')).toBe(`Hallo Welt – ${SITE_NAME}`);
  });

  it('ignoriert leere und nur aus Leerraum bestehende Titel', () => {
    expect(pageTitle('')).toBe(SITE_NAME);
    expect(pageTitle('   ')).toBe(SITE_NAME);
  });
});

describe('Seitenkonstanten', () => {
  it('ist deutschsprachig', () => {
    expect(SITE_LANG).toBe('de');
  });
});
