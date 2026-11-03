import { describe, expect, it } from 'vitest';
import {
  ConfigError,
  DEFAULT_SETTINGS,
  SETTING_SPECS,
  readSettings,
} from './config.ts';

describe('readSettings', () => {
  it('returns the defaults without variables', () => {
    expect(readSettings({})).toEqual({
      feedPageSize: 20,
      feedExcerptChars: 200,
      memosDescriptionChars: 160,
      memosTimeoutMs: 30_000,
      memosMaxFileBytes: 25 * 1024 * 1024,
      rssItems: 50,
      releasesKept: 3,
    });
    expect(readSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('reads set values', () => {
    const s = readSettings({
      MUFFEL_FEED_PAGE_SIZE: '50',
      MUFFEL_FEED_EXCERPT_CHARS: '300',
      MUFFEL_MEMOS_DESCRIPTION_CHARS: '100',
      MUFFEL_MEMOS_TIMEOUT_MS: '5000',
      MUFFEL_MEMOS_MAX_FILE_MB: '10',
      MUFFEL_RSS_ITEMS: '30',
    });
    expect(s).toEqual({
      feedPageSize: 50,
      feedExcerptChars: 300,
      memosDescriptionChars: 100,
      memosTimeoutMs: 5000,
      memosMaxFileBytes: 10 * 1024 * 1024,
      rssItems: 30,
      releasesKept: 3,
    });
  });

  it('treats empty variables as unset', () => {
    expect(readSettings({ MUFFEL_FEED_PAGE_SIZE: '' }).feedPageSize).toBe(20);
    expect(readSettings({ MUFFEL_FEED_PAGE_SIZE: '  ' }).feedPageSize).toBe(20);
  });

  it('allows whitespace around a number', () => {
    expect(readSettings({ MUFFEL_FEED_PAGE_SIZE: ' 7 ' }).feedPageSize).toBe(7);
  });

  it('accepts the bounds of the range and rejects values just outside', () => {
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

  it('rejects non-integers', () => {
    for (const value of [
      'abc',
      '2.5',
      '-1',
      '1e3',
      '0x10',
      '20 pieces',
      '+5',
    ]) {
      expect(() => readSettings({ MUFFEL_FEED_PAGE_SIZE: value })).toThrow(
        ConfigError,
      );
    }
  });

  it('lists all errors at once with variable name and range', () => {
    try {
      readSettings({
        MUFFEL_FEED_PAGE_SIZE: '0',
        MUFFEL_MEMOS_TIMEOUT_MS: 'x',
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const text = (error as Error).message;
      expect(text).toContain('MUFFEL_FEED_PAGE_SIZE');
      expect(text).toContain('MUFFEL_MEMOS_TIMEOUT_MS');
      expect(text).toMatch(/from 1 to \d+/);
    }
  });

  it('has a default within the range for every setting', () => {
    for (const spec of SETTING_SPECS) {
      expect(spec.default).toBeGreaterThanOrEqual(spec.min);
      expect(spec.default).toBeLessThanOrEqual(spec.max);
    }
  });
});
