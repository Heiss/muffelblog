import { describe, expect, it } from 'vitest';
import { leadOf, outlineOf } from './html-parts.ts';

describe('leadOf', () => {
  it('takes everything before the first heading and names that heading', () => {
    const lead = leadOf(
      '<p>One</p><ul><li>two</li></ul><h3>Part A: the <em>landscape</em></h3><p>Later</p>',
      '/p/x/',
    );
    expect(lead).toEqual({
      html: '<p>One</p><ul><li>two</li></ul>',
      next: 'Part A: the landscape',
    });
  });

  it('is the whole text when the page has no heading', () => {
    expect(leadOf('<p>Only text</p>\n<p>More</p>', '/p/x/')).toEqual({
      html: '<p>Only text</p>\n<p>More</p>',
      next: null,
    });
  });

  it('splits at any level from h1 to h6, only at the top level', () => {
    expect(leadOf('<p>a</p><h6>six</h6><p>b</p>', '/p/x/').next).toBe('six');
    expect(leadOf('<p>a</p><h1>one</h1>', '/p/x/').next).toBe('one');
    const nested = leadOf(
      '<blockquote><h3>inside</h3></blockquote><p>b</p>',
      '/p/x/',
    );
    expect(nested).toEqual({
      html: '<blockquote><h3>inside</h3></blockquote><p>b</p>',
      next: null,
    });
  });

  it('is empty when the page starts with a heading', () => {
    expect(leadOf('<h2>Start</h2><p>x</p>', '/p/x/')).toEqual({
      html: '',
      next: 'Start',
    });
  });

  it('gives no name for an empty heading', () => {
    expect(leadOf('<p>a</p><h2>  </h2>', '/p/x/')).toEqual({
      html: '<p>a</p>',
      next: null,
    });
  });

  it('collapses the whitespace of the heading text', () => {
    expect(leadOf('<p>a</p><h2>\n Two \n words </h2>', '/p/x/').next).toBe(
      'Two words',
    );
  });

  it('drops margin notes and keeps the annotated paragraph and the highlighted text', () => {
    const html =
      '<div class="annotated"><p>We <mark class="doc-comment">ship</mark> now.</p>' +
      '<aside class="margin-note margin-comment" role="note"><details open><summary>Comment</summary></details></aside></div>' +
      '<h2>Next</h2>';
    expect(leadOf(html, '/p/x/').html).toBe('<p>We ship now.</p>');
  });

  it('keeps a mark or a div that is no note markup', () => {
    expect(
      leadOf('<div class="other"><mark>x</mark></div>', '/p/x/').html,
    ).toBe('<div class="other"><mark>x</mark></div>');
  });

  it('drops the list of footnotes by its class or its data attribute', () => {
    expect(
      leadOf(
        '<p>a</p><section class="footnotes"><ol><li>n</li></ol></section>',
        '/p/x/',
      ).html,
    ).toBe('<p>a</p>');
    expect(
      leadOf('<p>a</p><section data-footnotes=""><p>n</p></section>', '/p/x/')
        .html,
    ).toBe('<p>a</p>');
    expect(leadOf('<section><p>kept</p></section>', '/p/x/').html).toBe(
      '<section><p>kept</p></section>',
    );
  });

  it('removes ids and points jumps inside the page at the page', () => {
    const lead = leadOf(
      '<p id="user-content-x">See<sup><a href="#user-content-fn-1" id="user-content-fnref-1">1</a></sup> <a href="/g/y/">y</a> <a href="https://example.org/#top">ext</a></p>',
      '/p/x/',
    );
    expect(lead.html).toBe(
      '<p>See<sup><a href="/p/x/#user-content-fn-1">1</a></sup> <a href="/g/y/">y</a> <a href="https://example.org/#top">ext</a></p>',
    );
  });
});

describe('outlineOf', () => {
  it('lists the two highest levels and gives their headings ids', () => {
    const out = outlineOf(
      '<h3>Teil A: Die Landschaft</h3><p>x</p><h4>1. Auftrag klären</h4><h5>deep</h5><h3>Grenzen</h3>',
    );
    expect(out.toc).toEqual([
      { id: 'teil-a-die-landschaft', text: 'Teil A: Die Landschaft', depth: 1 },
      { id: '1-auftrag-klaeren', text: '1. Auftrag klären', depth: 2 },
      { id: 'grenzen', text: 'Grenzen', depth: 1 },
    ]);
    expect(out.html).toBe(
      '<h3 id="teil-a-die-landschaft">Teil A: Die Landschaft</h3><p>x</p><h4 id="1-auftrag-klaeren">1. Auftrag klären</h4><h5>deep</h5><h3 id="grenzen">Grenzen</h3>',
    );
  });

  it('returns the HTML unchanged and no table without headings', () => {
    const html = '<p>a</p>\n<h1>own title is not part of the text</h1>';
    expect(outlineOf(html)).toEqual({ html, toc: [] });
  });

  it('makes ids unique, also against ids that are already there', () => {
    const out = outlineOf(
      '<p id="a">x</p><h2>A</h2><h2>A</h2><h2>!!!</h2><h2>!!!</h2>',
    );
    expect(out.toc.map((t) => t.id)).toEqual([
      'a-2',
      'a-3',
      'section',
      'section-2',
    ]);
  });

  it('keeps an id a heading already has', () => {
    const out = outlineOf('<h2 id="mine">Title</h2>');
    expect(out.toc).toEqual([{ id: 'mine', text: 'Title', depth: 1 }]);
    expect(out.html).toBe('<h2 id="mine">Title</h2>');
  });

  it('finds headings inside other elements and collapses their text', () => {
    const out = outlineOf(
      '<div class="annotated"><h2>Inside\n  <code>x</code></h2></div>',
    );
    expect(out.toc).toEqual([{ id: 'inside-x', text: 'Inside x', depth: 1 }]);
  });
});
