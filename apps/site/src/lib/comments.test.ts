import { describe, expect, it } from 'vitest';
import { commentsConfig, staticCommentsConfig } from './comments';

describe('commentsConfig', () => {
  it('is off without COMMENTS_URL', () => {
    expect(commentsConfig({})).toBeUndefined();
    expect(commentsConfig({ COMMENTS_URL: '' })).toBeUndefined();
    expect(commentsConfig({ COMMENTS_URL: '  ' })).toBeUndefined();
  });

  it('reads the host and uses the default site id', () => {
    expect(
      commentsConfig({ COMMENTS_URL: 'https://comments.example.org' }),
    ).toEqual({
      host: 'https://comments.example.org',
      siteId: 'muffelblog',
    });
  });

  it('strips a trailing slash and keeps a port', () => {
    expect(
      commentsConfig({ COMMENTS_URL: 'http://localhost:8081/' })?.host,
    ).toBe('http://localhost:8081');
  });

  it('takes the site id from COMMENTS_SITE_ID', () => {
    expect(
      commentsConfig({
        COMMENTS_URL: 'https://c.example',
        COMMENTS_SITE_ID: 'blog',
      })?.siteId,
    ).toBe('blog');
  });

  it('stops the build for an address that is not a plain origin', () => {
    for (const bad of [
      'nonsense',
      'ftp://c.example',
      'javascript:alert(1)',
      'https://c.example/path',
      'https://c.example/?x=1',
      'https://user:pw@c.example',
    ]) {
      expect(() => commentsConfig({ COMMENTS_URL: bad }), bad).toThrow(
        /COMMENTS_URL/,
      );
    }
  });

  it('stops the build for a site id with odd characters', () => {
    expect(() =>
      commentsConfig({
        COMMENTS_URL: 'https://c.example',
        COMMENTS_SITE_ID: 'a b"',
      }),
    ).toThrow(/COMMENTS_SITE_ID/);
  });
});

describe('staticCommentsConfig', () => {
  it('is off without REMARK_INTERNAL_URL and without fixtures', () => {
    expect(staticCommentsConfig({})).toBeUndefined();
  });

  it('needs SITE_URL, because the page address is the key of its comments', () => {
    expect(() =>
      staticCommentsConfig({ REMARK_INTERNAL_URL: 'http://remark42:8080' }),
    ).toThrow(/SITE_URL/);
  });

  it('reads the internal address and the site id', () => {
    expect(
      staticCommentsConfig({
        REMARK_INTERNAL_URL: 'http://remark42:8080',
        SITE_URL: 'https://blog.example',
        COMMENTS_SITE_ID: 'blog',
      }),
    ).toEqual({
      kind: 'remark42',
      baseUrl: 'http://remark42:8080',
      siteId: 'blog',
    });
  });

  it('uses the comment fixtures with the edge-case set', () => {
    expect(staticCommentsConfig({ MUFFEL_FIXTURES: '1' })).toEqual({
      kind: 'fixtures',
      folder: 'comments',
    });
  });

  it('has no comments for the demo set unless Remark42 is configured', () => {
    expect(staticCommentsConfig({ MUFFEL_FIXTURES: 'demo' })).toBeUndefined();
    expect(
      staticCommentsConfig({
        MUFFEL_FIXTURES: 'demo',
        REMARK_INTERNAL_URL: 'http://remark42:8080',
        SITE_URL: 'http://localhost:8080',
      })?.kind,
    ).toBe('remark42');
  });
});
