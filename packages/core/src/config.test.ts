import { describe, expect, it } from 'vitest';
import {
  ConfigError,
  DEFAULT_SETTINGS,
  SETTING_SPECS,
  readSettings,
} from './config.ts';

describe('readSettings', () => {
  it('liefert ohne Variablen die Standardwerte', () => {
    expect(readSettings({})).toEqual({
      feedPageSize: 20,
      feedExcerptChars: 200,
      memosDescriptionChars: 160,
      memosTimeoutMs: 30_000,
      memosMaxFileBytes: 25 * 1024 * 1024,
    });
    expect(readSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('liest gesetzte Werte', () => {
    const s = readSettings({
      MUFFEL_FEED_PAGE_SIZE: '50',
      MUFFEL_FEED_EXCERPT_CHARS: '300',
      MUFFEL_MEMOS_DESCRIPTION_CHARS: '100',
      MUFFEL_MEMOS_TIMEOUT_MS: '5000',
      MUFFEL_MEMOS_MAX_FILE_MB: '10',
    });
    expect(s).toEqual({
      feedPageSize: 50,
      feedExcerptChars: 300,
      memosDescriptionChars: 100,
      memosTimeoutMs: 5000,
      memosMaxFileBytes: 10 * 1024 * 1024,
    });
  });

  it('behandelt leere Variablen wie nicht gesetzt', () => {
    expect(readSettings({ MUFFEL_FEED_PAGE_SIZE: '' }).feedPageSize).toBe(20);
    expect(readSettings({ MUFFEL_FEED_PAGE_SIZE: '  ' }).feedPageSize).toBe(20);
  });

  it('erlaubt Leerraum um eine Zahl', () => {
    expect(readSettings({ MUFFEL_FEED_PAGE_SIZE: ' 7 ' }).feedPageSize).toBe(7);
  });

  it('akzeptiert die Grenzen der Spanne und lehnt knapp außerhalb ab', () => {
    for (const spec of SETTING_SPECS) {
      expect(() =>
        readSettings({ [spec.env]: String(spec.min) }),
      ).not.toThrow();
      expect(() =>
        readSettings({ [spec.env]: String(spec.max) }),
      ).not.toThrow();
      expect(() => readSettings({ [spec.env]: String(spec.min - 1) })).toThrow(
        ConfigError,
      );
      expect(() => readSettings({ [spec.env]: String(spec.max + 1) })).toThrow(
        ConfigError,
      );
    }
  });

  it('lehnt Nicht-Ganzzahlen ab', () => {
    for (const wert of ['abc', '2.5', '-1', '1e3', '0x10', '20 Stück', '+5']) {
      expect(() => readSettings({ MUFFEL_FEED_PAGE_SIZE: wert })).toThrow(
        ConfigError,
      );
    }
  });

  it('nennt alle Fehler auf einmal mit Variablenname und Spanne', () => {
    try {
      readSettings({
        MUFFEL_FEED_PAGE_SIZE: '0',
        MUFFEL_MEMOS_TIMEOUT_MS: 'x',
      });
      expect.unreachable();
    } catch (fehler) {
      expect(fehler).toBeInstanceOf(ConfigError);
      const text = (fehler as Error).message;
      expect(text).toContain('MUFFEL_FEED_PAGE_SIZE');
      expect(text).toContain('MUFFEL_MEMOS_TIMEOUT_MS');
      expect(text).toMatch(/1 bis \d+/);
    }
  });

  it('hat für jede Einstellung einen Standardwert innerhalb der Spanne', () => {
    for (const spec of SETTING_SPECS) {
      expect(spec.default).toBeGreaterThanOrEqual(spec.min);
      expect(spec.default).toBeLessThanOrEqual(spec.max);
    }
  });
});
