import { describe, expect, it } from 'vitest';
import { plainExcerpt, withoutMarginNotes } from './excerpt.ts';

describe('margin notes in excerpts and feeds', () => {
  const html =
    '<div class="annotated"><p>Text davor.</p><aside class="margin-note"><details open><summary>Kommentar</summary><p>Geheim?</p></details></aside></div><p>Danach.</p>';

  it('are left out of the excerpt', () => {
    expect(plainExcerpt(html)).toBe('Text davor. Danach.');
  });

  it('are cut out of the HTML for the feed, the text stays', () => {
    expect(withoutMarginNotes(html)).toBe(
      '<div class="annotated"><p>Text davor.</p></div><p>Danach.</p>',
    );
    expect(withoutMarginNotes('<p>nichts</p>')).toBe('<p>nichts</p>');
  });
});

describe('plainExcerpt', () => {
  it('removes tags and collapses whitespace', () => {
    expect(
      plainExcerpt('<p>Hallo <strong>Welt</strong></p>\n<p>zwei</p>'),
    ).toBe('Hallo Welt zwei');
  });

  it('keeps scripts, styles, code blocks and images out of the text', () => {
    const html =
      '<p>vorn</p><script>alert(1)</script><style>p{}</style><pre><code>x = 1</code></pre><img alt="Bild" src="/a.webp"><p>hinten</p>';
    expect(plainExcerpt(html)).toBe('vorn hinten');
  });

  it('resolves entities and does not re-encode anything', () => {
    expect(
      plainExcerpt('<p>a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39;</p>'),
    ).toBe('a & b <c> "d" \'e\'');
  });

  it('cuts at a word boundary with an ellipsis', () => {
    const text = '<p>' + 'wort '.repeat(100) + '</p>';
    const result = plainExcerpt(text, 24);
    expect(result).toBe('wort wort wort wort…');
    expect(result.length).toBeLessThanOrEqual(24);
  });

  it('cuts a single long word hard', () => {
    const result = plainExcerpt('<p>' + 'x'.repeat(100) + '</p>', 10);
    expect(result).toBe('xxxxxxxxx…');
  });

  it('leaves short texts unchanged', () => {
    expect(plainExcerpt('<p>kurz</p>', 200)).toBe('kurz');
  });

  it('returns empty text for empty HTML', () => {
    expect(plainExcerpt('')).toBe('');
    expect(plainExcerpt('<img src="/a.webp">')).toBe('');
  });
});
