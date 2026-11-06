import { describe, expect, it } from 'vitest';
import { relMeLinks, webmentionEndpoint } from './indieweb';

describe('webmentionEndpoint', () => {
  it('is announced only when receiving is on and the domain is known', () => {
    expect(
      webmentionEndpoint({ SITE_URL: 'https://blog.example.org' }),
    ).toBeUndefined();
    expect(
      webmentionEndpoint({ MUFFEL_WEBMENTIONS_RECEIVE: '1' }),
    ).toBeUndefined();
  });

  it('points to webmention.io with the host of the site', () => {
    expect(
      webmentionEndpoint({
        MUFFEL_WEBMENTIONS_RECEIVE: '1',
        SITE_URL: 'https://blog.example.org',
      }),
    ).toBe('https://webmention.io/blog.example.org/webmention');
  });

  it('uses the stand-in of the demo when WEBMENTION_IO_URL is set', () => {
    expect(
      webmentionEndpoint({
        MUFFEL_WEBMENTIONS_RECEIVE: '1',
        SITE_URL: 'http://localhost:8080',
        WEBMENTION_IO_URL: 'http://localhost:8090/',
      }),
    ).toBe('http://localhost:8090/localhost/webmention');
  });
});

describe('explicit receiving endpoint', () => {
  const enabled = {
    MUFFEL_WEBMENTIONS_RECEIVE: '1',
    SITE_URL: 'https://blog.example.org',
  };
  it('uses the account endpoint exactly, independently of the read API base', () => {
    expect(
      webmentionEndpoint({
        ...enabled,
        WEBMENTION_ENDPOINT: 'https://webmention.io/account.example/webmention',
        WEBMENTION_IO_URL: 'https://api.example.org',
      }),
    ).toBe('https://webmention.io/account.example/webmention');
  });
  it('rejects credentials, fragments and unsupported protocols', () => {
    for (const endpoint of [
      'not-a-url',
      'javascript:alert(1)',
      'https://user:password@example.org/',
      'https://example.org/#token',
    ]) {
      expect(() =>
        webmentionEndpoint({ ...enabled, WEBMENTION_ENDPOINT: endpoint }),
      ).toThrow(/WEBMENTION_ENDPOINT/);
    }
  });
});

describe('relMeLinks', () => {
  it('reads a comma separated list of profiles', () => {
    expect(
      relMeLinks({
        MUFFEL_REL_ME: ' https://github.com/heiss , mailto:me@example.org ',
      }),
    ).toEqual(['https://github.com/heiss', 'mailto:me@example.org']);
  });

  it('is empty without the variable', () => {
    expect(relMeLinks({})).toEqual([]);
  });

  it('stops the build for anything but http, https and mailto', () => {
    expect(() => relMeLinks({ MUFFEL_REL_ME: 'javascript:alert(1)' })).toThrow(
      /MUFFEL_REL_ME/,
    );
    expect(() => relMeLinks({ MUFFEL_REL_ME: 'github.com/heiss' })).toThrow(
      /MUFFEL_REL_ME/,
    );
  });
});
