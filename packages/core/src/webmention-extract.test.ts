import { describe, expect, it } from 'vitest';
import {
  extractEntry,
  findEndpoint,
  parseLinkHeader,
} from './webmention-extract.ts';

const page = (content: string, extra = '') =>
  `<!doctype html><html><head><title>x</title>${extra}</head><body>
   <header><a href="https://outside.example/nav">nav</a></header>
   <article class="h-entry"><h1 class="p-name">T</h1>
   <div class="content e-content">${content}</div>
   <footer><a href="https://outside.example/footer">f</a></footer></article></body></html>`;

describe('extractEntry', () => {
  it('collects the links of the content only, as absolute addresses, without duplicates', () => {
    const e = extractEntry(
      page(
        `<p><a href="https://a.example/x">a</a> <a href="/p/other/">own</a>
         <a href="https://a.example/x">again</a> <a href="https://b.example/y#top">b</a></p>`,
      ),
      'https://blog.example/p/post/',
    );
    expect(e?.links).toEqual([
      'https://a.example/x',
      'https://blog.example/p/other/',
      'https://b.example/y#top',
    ]);
  });

  it('ignores links outside the content and anything that is not http or https', () => {
    const e = extractEntry(
      page(
        `<a href="mailto:me@example.org">m</a><a href="javascript:alert(1)">j</a>
         <a href="ftp://f.example/x">f</a><a href="#top">frag</a><a>no href</a>
         <a href="https://ok.example/">ok</a>`,
      ),
      'https://blog.example/p/post/',
    );
    expect(e?.links).toEqual([
      'https://blog.example/p/post/#top',
      'https://ok.example/',
    ]);
  });

  it('gives a different hash when the content changes, the same when it does not', () => {
    const base = 'https://blog.example/p/post/';
    const a = extractEntry(
      page('<p>one <a href="https://a.example/">a</a></p>'),
      base,
    );
    const same = extractEntry(
      page('<p>one <a href="https://a.example/">a</a></p>'),
      base,
    );
    const changed = extractEntry(
      page('<p>two <a href="https://a.example/">a</a></p>'),
      base,
    );
    expect(a?.hash).toBe(same?.hash);
    expect(a?.hash).not.toBe(changed?.hash);
    expect(a?.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not change the hash when only the page around the content changes', () => {
    const base = 'https://blog.example/p/post/';
    const a = extractEntry(page('<p>x</p>'), base);
    const b = extractEntry(
      page('<p>x</p>', '<meta name="x" content="y">'),
      base,
    );
    expect(a?.hash).toBe(b?.hash);
  });

  it('returns null for a page without an h-entry content (list pages, 404)', () => {
    expect(
      extractEntry('<html><body><p>hi</p></body></html>', 'https://b.example/'),
    ).toBeNull();
    expect(
      extractEntry(
        '<div class="e-content"><a href="https://x.example/">x</a></div>',
        'https://b.example/',
      ),
    ).toBeNull();
  });

  it('works for an entry without links', () => {
    const e = extractEntry(
      page('<p>plain</p>'),
      'https://blog.example/p/post/',
    );
    expect(e?.links).toEqual([]);
  });
});

describe('parseLinkHeader', () => {
  it('reads several links with their rel values', () => {
    expect(
      parseLinkHeader(
        '<https://a.example/1>; rel="webmention", </2>; rel=other; title="x", <3>; rel="webmention http://webmention.org/"',
      ),
    ).toEqual([
      { url: 'https://a.example/1', rel: ['webmention'] },
      { url: '/2', rel: ['other'] },
      { url: '3', rel: ['webmention', 'http://webmention.org/'] },
    ]);
  });

  it('survives garbage', () => {
    expect(parseLinkHeader('')).toEqual([]);
    expect(parseLinkHeader('nonsense, ;;;, <')).toEqual([]);
  });
});

describe('findEndpoint', () => {
  const res = (
    over: Partial<{
      url: string;
      headers: Record<string, string>;
      body: string;
    }>,
  ) => ({
    url: 'https://t.example/post',
    headers: {},
    body: '',
    ...over,
  });

  it('prefers the Link header over the page', () => {
    expect(
      findEndpoint(
        res({
          headers: {
            link: '</from-header>; rel="webmention"',
            'content-type': 'text/html',
          },
          body: '<link rel="webmention" href="/from-page">',
        }),
      ),
    ).toBe('https://t.example/from-header');
  });

  it('finds <link> and <a> with rel webmention, the first in document order', () => {
    expect(
      findEndpoint(
        res({
          headers: { 'content-type': 'text/html; charset=utf-8' },
          body: '<html><head><link rel="stylesheet" href="/s.css"><link rel="me webmention" href="/wm"></head><body><a rel="webmention" href="/later">x</a></body></html>',
        }),
      ),
    ).toBe('https://t.example/wm');
    expect(
      findEndpoint(
        res({
          headers: { 'content-type': 'text/html' },
          body: '<body><a rel="webmention" href="https://hub.example/wm">x</a></body>',
        }),
      ),
    ).toBe('https://hub.example/wm');
  });

  it('resolves against the final address after redirects', () => {
    expect(
      findEndpoint(
        res({
          url: 'https://moved.example/dir/post',
          headers: { 'content-type': 'text/html' },
          body: '<link rel="webmention" href="wm">',
        }),
      ),
    ).toBe('https://moved.example/dir/wm');
  });

  it('treats an empty href as the page itself', () => {
    expect(
      findEndpoint(
        res({
          headers: { 'content-type': 'text/html' },
          body: '<link rel="webmention" href="">',
        }),
      ),
    ).toBe('https://t.example/post');
  });

  it('returns null without an endpoint, for a non-http endpoint, and for non-HTML bodies', () => {
    expect(
      findEndpoint(
        res({ headers: { 'content-type': 'text/html' }, body: '<p>none</p>' }),
      ),
    ).toBeNull();
    expect(
      findEndpoint(
        res({
          headers: { 'content-type': 'text/html' },
          body: '<link rel="webmention" href="javascript:alert(1)">',
        }),
      ),
    ).toBeNull();
    expect(
      findEndpoint(
        res({
          headers: { 'content-type': 'application/json' },
          body: '<link rel="webmention" href="/wm">',
        }),
      ),
    ).toBeNull();
  });

  it('ignores a rel that only contains the word, such as "webmentions"', () => {
    expect(
      findEndpoint(
        res({
          headers: { 'content-type': 'text/html' },
          body: '<link rel="webmentions" href="/wm">',
        }),
      ),
    ).toBeNull();
  });
});
