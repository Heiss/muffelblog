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
      checkIntervalSeconds: 180,
      debounceChecks: 1,
      lang: 'en',
      webmentionsTimeoutMs: 10_000,
      webmentionsMaxBytes: 1024 * 1024,
      webmentionsMaxTargets: 10,
      webmentionsDelayMs: 1000,
      webmentionsAttempts: 3,
      webmentionsNoEndpointDays: 30,
      webmentionsEndpointDays: 7,
      webmentionsSend: false,
      webmentionsAllowPrivate: false,
      webmentionsBlock: [],
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
      MUFFEL_LANG: 'de',
    });
    expect(s).toEqual({
      feedPageSize: 50,
      feedExcerptChars: 300,
      memosDescriptionChars: 100,
      memosTimeoutMs: 5000,
      memosMaxFileBytes: 10 * 1024 * 1024,
      rssItems: 30,
      releasesKept: 3,
      checkIntervalSeconds: 180,
      debounceChecks: 1,
      lang: 'de',
      webmentionsTimeoutMs: 10_000,
      webmentionsMaxBytes: 1024 * 1024,
      webmentionsMaxTargets: 10,
      webmentionsDelayMs: 1000,
      webmentionsAttempts: 3,
      webmentionsNoEndpointDays: 30,
      webmentionsEndpointDays: 7,
      webmentionsSend: false,
      webmentionsAllowPrivate: false,
      webmentionsBlock: [],
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

  describe('MUFFEL_LANG', () => {
    it('defaults to English, also when empty', () => {
      expect(readSettings({}).lang).toBe('en');
      expect(readSettings({ MUFFEL_LANG: '' }).lang).toBe('en');
    });

    it('accepts the supported languages, in any case and with spaces', () => {
      expect(readSettings({ MUFFEL_LANG: 'de' }).lang).toBe('de');
      expect(readSettings({ MUFFEL_LANG: ' EN ' }).lang).toBe('en');
    });

    it('stops the build for an unknown language and names the allowed ones', () => {
      expect(() => readSettings({ MUFFEL_LANG: 'fr' })).toThrow(ConfigError);
      expect(() => readSettings({ MUFFEL_LANG: 'fr' })).toThrow(/de, en/);
    });

    it('reports it together with other invalid settings', () => {
      expect(() =>
        readSettings({ MUFFEL_LANG: 'fr', MUFFEL_RSS_ITEMS: 'x' }),
      ).toThrow(
        /MUFFEL_LANG[\s\S]*MUFFEL_RSS_ITEMS|MUFFEL_RSS_ITEMS[\s\S]*MUFFEL_LANG/,
      );
    });
  });

  describe('webmention sending', () => {
    it('is off by default and does not allow private addresses', () => {
      const s = readSettings({});
      expect(s.webmentionsSend).toBe(false);
      expect(s.webmentionsAllowPrivate).toBe(false);
      expect(s.webmentionsBlock).toEqual([]);
    });

    it('switches on only with 1 and off with 0, anything else stops the build', () => {
      expect(
        readSettings({ MUFFEL_WEBMENTIONS_SEND: '1' }).webmentionsSend,
      ).toBe(true);
      expect(
        readSettings({ MUFFEL_WEBMENTIONS_SEND: '0' }).webmentionsSend,
      ).toBe(false);
      expect(
        readSettings({ MUFFEL_WEBMENTIONS_SEND: '' }).webmentionsSend,
      ).toBe(false);
      for (const bad of ['true', 'yes', '2', 'on']) {
        expect(() => readSettings({ MUFFEL_WEBMENTIONS_SEND: bad })).toThrow(
          /MUFFEL_WEBMENTIONS_SEND/,
        );
        expect(() =>
          readSettings({ MUFFEL_WEBMENTIONS_ALLOW_PRIVATE: bad }),
        ).toThrow(/MUFFEL_WEBMENTIONS_ALLOW_PRIVATE/);
      }
    });

    it('reads the block list as lower case host names', () => {
      expect(
        readSettings({
          MUFFEL_WEBMENTIONS_BLOCK: ' Example.org, news.example.com ,,',
        }).webmentionsBlock,
      ).toEqual(['example.org', 'news.example.com']);
    });

    it('rejects entries of the block list that are not host names', () => {
      for (const bad of ['https://example.org', 'a b', 'exa_mple.org', '/x']) {
        expect(() => readSettings({ MUFFEL_WEBMENTIONS_BLOCK: bad })).toThrow(
          /MUFFEL_WEBMENTIONS_BLOCK/,
        );
      }
    });

    it('reads the limits, the size in KB', () => {
      const s = readSettings({
        MUFFEL_WEBMENTIONS_TIMEOUT_MS: '5000',
        MUFFEL_WEBMENTIONS_MAX_KB: '256',
        MUFFEL_WEBMENTIONS_MAX_TARGETS: '5',
        MUFFEL_WEBMENTIONS_DELAY_MS: '0',
        MUFFEL_WEBMENTIONS_ATTEMPTS: '1',
      });
      expect(s.webmentionsTimeoutMs).toBe(5000);
      expect(s.webmentionsMaxBytes).toBe(256 * 1024);
      expect(s.webmentionsMaxTargets).toBe(5);
      expect(s.webmentionsDelayMs).toBe(0);
      expect(s.webmentionsAttempts).toBe(1);
    });
  });
});
