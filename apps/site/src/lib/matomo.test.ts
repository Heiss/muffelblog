import { describe, expect, it } from 'vitest';
import { matomoCommands, matomoConfig } from './matomo';

describe('matomoConfig', () => {
  it('is off without both variables', () => {
    expect(matomoConfig({})).toBeUndefined();
    expect(
      matomoConfig({ MATOMO_URL: ' ', MATOMO_SITE_ID: '' }),
    ).toBeUndefined();
  });

  it('reads an origin and a site id', () => {
    expect(
      matomoConfig({
        MATOMO_URL: 'https://stats.example.org',
        MATOMO_SITE_ID: '3',
      }),
    ).toEqual({ base: 'https://stats.example.org/', siteId: '3' });
  });

  it('accepts a path that ends with a slash', () => {
    expect(
      matomoConfig({
        MATOMO_URL: 'https://example.org/matomo/',
        MATOMO_SITE_ID: '1',
      })?.base,
    ).toBe('https://example.org/matomo/');
  });

  it('stops the build when only one of the two is set', () => {
    expect(() => matomoConfig({ MATOMO_URL: 'https://s.example.org' })).toThrow(
      /MATOMO_SITE_ID/,
    );
    expect(() => matomoConfig({ MATOMO_SITE_ID: '1' })).toThrow(/MATOMO_URL/);
  });

  it('stops the build for an address the Content Security Policy cannot name exactly', () => {
    for (const url of [
      'stats.example.org',
      'ftp://stats.example.org',
      'https://user:pw@stats.example.org',
      'https://example.org/matomo',
      'https://example.org/?a=1',
      'https://example.org/#x',
    ]) {
      expect(
        () => matomoConfig({ MATOMO_URL: url, MATOMO_SITE_ID: '1' }),
        url,
      ).toThrow(/MATOMO_URL/);
    }
  });

  it('stops the build for a site id that is not a positive whole number', () => {
    for (const id of ['0', '-1', 'abc', '1.5']) {
      expect(
        () =>
          matomoConfig({
            MATOMO_URL: 'https://s.example.org',
            MATOMO_SITE_ID: id,
          }),
        id,
      ).toThrow(/MATOMO_SITE_ID/);
    }
  });
});

describe('matomoCommands', () => {
  it('switches cookies off before the page view is tracked', () => {
    const commands = matomoCommands({
      base: 'https://s.example.org/',
      siteId: '3',
    });
    expect(commands[0]).toEqual(['disableCookies']);
    expect(commands).toContainEqual([
      'setTrackerUrl',
      'https://s.example.org/matomo.php',
    ]);
    expect(commands).toContainEqual(['setSiteId', '3']);
    expect(commands.findIndex((c) => c[0] === 'trackPageView')).toBeGreaterThan(
      0,
    );
  });
});
