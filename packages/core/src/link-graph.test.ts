import { describe, expect, it } from 'vitest';
import { buildGraph, extractLinks, linksOf } from './link-graph.ts';

const SITE = 'https://blog.example.org';

describe('extractLinks', () => {
  it('finds links to posts, memos and terms, and the domains of external links', () => {
    const links = extractLinks(
      `<a href="/p/a/">a</a> <a href="/g/b/#x">b</a> <a href="${SITE}/m/c/">c</a>
       <a href="https://www.wikipedia.org/wiki/X">w</a> <a href="https://de.wikipedia.org/">d</a>
       <a href="/tag/x/">t</a> <a href="mailto:a@b.c">m</a> <a href="#top">#</a>`,
      SITE,
    );
    expect(links.pages).toEqual(['/p/a/', '/g/b/', '/m/c/']);
    expect(links.domains).toEqual(['wikipedia.org', 'de.wikipedia.org']);
  });

  it('decodes &amp; in addresses and ignores broken ones', () => {
    const links = extractLinks(
      '<a href="https://x.example/?a=1&amp;b=2">x</a><a href="http://[bad">y</a>',
    );
    expect(links.domains).toEqual(['x.example']);
  });
});

describe('buildGraph', () => {
  const entries = [
    {
      url: '/p/a/',
      title: 'A',
      kind: 'post' as const,
      html: '<a href="/g/b/">b</a><a href="/p/a/">self</a><a href="https://wikipedia.org/x">w</a><a href="/p/gone/">gone</a>',
    },
    {
      url: '/g/b/',
      title: 'B',
      kind: 'glossary' as const,
      html: '<a href="/p/a/">a</a><a href="/p/a/">again</a>',
    },
    {
      url: '/m/c/',
      title: 'Memo',
      kind: 'memo' as const,
      html: '<a href="https://wikipedia.org/y">w</a>',
    },
  ];

  it('has nodes for the pages and one node per external domain', () => {
    const g = buildGraph(entries, SITE);
    expect(g.nodes.map((n) => n.id)).toEqual([
      '/p/a/',
      '/g/b/',
      '/m/c/',
      'domain:wikipedia.org',
    ]);
    expect(g.nodes.find((n) => n.id === 'domain:wikipedia.org')).toEqual({
      id: 'domain:wikipedia.org',
      kind: 'domain',
      title: 'wikipedia.org',
    });
  });

  it('has directed edges without self links, duplicates or unknown pages', () => {
    const g = buildGraph(entries, SITE);
    expect(g.edges).toEqual([
      { from: '/p/a/', to: '/g/b/' },
      { from: '/p/a/', to: 'domain:wikipedia.org' },
      { from: '/g/b/', to: '/p/a/' },
      { from: '/m/c/', to: 'domain:wikipedia.org' },
    ]);
  });

  it('lists what a page links to and what links to it', () => {
    const g = buildGraph(entries, SITE);
    const a = linksOf(g, '/p/a/');
    expect(a.to.map((n) => n.id)).toEqual(['/g/b/', 'domain:wikipedia.org']);
    expect(a.from.map((n) => n.id)).toEqual(['/g/b/']);
  });
});
