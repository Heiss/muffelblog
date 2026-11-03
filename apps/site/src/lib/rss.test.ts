import { describe, expect, it } from 'vitest';
import { absolutizeHtml, rssXml } from './rss';
import type { RssItem } from './rss';

const item = (over: Partial<RssItem> = {}): RssItem => ({
  id: 'post:a',
  url: '/p/a/',
  title: 'Titel & mehr',
  date: new Date('2026-11-02T10:00:00Z'),
  summary: 'Kurz',
  html: '<p>Text</p>',
  tags: ['it'],
  ...over,
});

const opts = { title: 'Muffelblog', description: 'Ein Blog', lang: 'de' };

describe('rssXml', () => {
  it('builds a valid channel with absolute links', () => {
    const xml = rssXml('https://example.org', [item()], opts);
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('<link>https://example.org/</link>');
    expect(xml).toContain(
      '<atom:link href="https://example.org/feed.xml" rel="self"',
    );
    expect(xml).toContain('<link>https://example.org/p/a/</link>');
    expect(xml).toContain('<language>de</language>');
  });

  it('escapes the title and puts full text in content:encoded', () => {
    const xml = rssXml('https://example.org', [item()], opts);
    expect(xml).toContain('<title>Titel &amp; mehr</title>');
    expect(xml).toContain('<![CDATA[<p>Text</p>]]>');
    expect(xml).toContain('<description>Kurz</description>');
  });

  it('uses the stable id as GUID, independent of date and domain', () => {
    const a = rssXml('https://a.example', [item()], opts);
    const b = rssXml(
      'https://b.example',
      [item({ date: new Date('2020-01-01') })],
      opts,
    );
    const guid = '<guid isPermaLink="false">post:a</guid>';
    expect(a).toContain(guid);
    expect(b).toContain(guid);
  });

  it('writes RFC 822 dates and categories', () => {
    const xml = rssXml('https://example.org', [item()], opts);
    expect(xml).toContain('<pubDate>Mon, 02 Nov 2026 10:00:00 GMT</pubDate>');
    expect(xml).toContain('<category>it</category>');
  });

  it('keeps CDATA safe when the text contains the end marker', () => {
    const xml = rssXml(
      'https://example.org',
      [item({ html: '<p>a ]]> b</p>' })],
      opts,
    );
    expect(xml).not.toContain('a ]]> b');
    expect(xml).toContain('a ]]]]><![CDATA[> b');
  });

  it('limits the number of entries, newest first as given', () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      item({ id: `post:${i}`, url: `/p/${i}/` }),
    );
    const xml = rssXml('https://example.org', many, { ...opts, limit: 3 });
    expect(xml.match(/<item>/g)).toHaveLength(3);
  });

  it('works without entries', () => {
    expect(rssXml('https://example.org', [], opts)).toContain('<channel>');
  });

  it('rejects a base that is not http(s)', () => {
    expect(() => rssXml('ftp://x', [], opts)).toThrow(/SITE_URL/);
    expect(() => rssXml('nonsense', [], opts)).toThrow(/SITE_URL/);
  });

  it('omits the full text for items without html', () => {
    const xml = rssXml(
      'https://example.org',
      [item({ html: undefined })],
      opts,
    );
    expect(xml).not.toContain('content:encoded');
  });
});

describe('absolutizeHtml', () => {
  const o = 'https://example.org';
  it('makes root-relative src and href absolute', () => {
    expect(
      absolutizeHtml('<img src="/media/a.webp"><a href="/p/x/">x</a>', o),
    ).toBe(
      '<img src="https://example.org/media/a.webp"><a href="https://example.org/p/x/">x</a>',
    );
  });
  it('handles srcset with several candidates', () => {
    expect(
      absolutizeHtml(
        '<img srcset="/media/a.webp 480w, /media/b.webp 960w">',
        o,
      ),
    ).toBe(
      '<img srcset="https://example.org/media/a.webp 480w, https://example.org/media/b.webp 960w">',
    );
  });
  it('leaves absolute, protocol-relative and fragment links alone', () => {
    const html =
      '<a href="https://x.org/">a</a><a href="//y.org/">b</a><a href="#top">c</a>';
    expect(absolutizeHtml(html, o)).toBe(html);
  });
});
