import { describe, expect, it } from 'vitest';
import { contentConfig } from './content.ts';

describe('contentConfig', () => {
  it('verlangt eine ausdrückliche Konfiguration und liefert nie stillschweigend Beispieldaten', () => {
    expect(() => contentConfig({})).toThrow(/CONTENT_DIR/);
    expect(() => contentConfig({})).toThrow(/MEMOS_URL/);
    expect(() => contentConfig({})).toThrow(/MUFFEL_FIXTURES/);
  });

  it('nennt die fehlende Variable, wenn nur eine gesetzt ist', () => {
    expect(() => contentConfig({ CONTENT_DIR: '/inhalt' })).toThrow(
      /MEMOS_URL/,
    );
    expect(() => contentConfig({ MEMOS_URL: 'http://memos:5230' })).toThrow(
      /CONTENT_DIR/,
    );
  });

  it('nutzt die Beispieldaten nur mit MUFFEL_FIXTURES=1', () => {
    const config = contentConfig({ MUFFEL_FIXTURES: '1' });
    expect(config.contentDir).toMatch(/packages\/core\/fixtures\/content$/);
    expect(typeof config.memos.listPublicMemos).toBe('function');
    expect(() => contentConfig({ MUFFEL_FIXTURES: 'true' })).toThrow(
      /CONTENT_DIR/,
    );
  });

  it('bricht bei ungültigem Zeitlimit ab, statt es zu ignorieren', () => {
    const env = { CONTENT_DIR: '/inhalt', MEMOS_URL: 'http://memos:5230' };
    expect(() =>
      contentConfig({ ...env, MUFFEL_MEMOS_TIMEOUT_MS: 'schnell' }),
    ).toThrow(/MUFFEL_MEMOS_TIMEOUT_MS/);
    expect(() =>
      contentConfig({ ...env, MUFFEL_MEMOS_TIMEOUT_MS: '5000' }),
    ).not.toThrow();
  });

  it('übernimmt Ordner und Memos-Adresse aus der Umgebung', () => {
    const config = contentConfig({
      CONTENT_DIR: '/inhalt',
      MEMOS_URL: 'http://memos:5230',
    });
    expect(config.contentDir).toBe('/inhalt');
  });

  it('lehnt eine ungültige Memos-Adresse ab', () => {
    expect(() =>
      contentConfig({ CONTENT_DIR: '/inhalt', MEMOS_URL: 'kein url' }),
    ).toThrow();
  });
});
