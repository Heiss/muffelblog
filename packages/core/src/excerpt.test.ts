import { describe, expect, it } from 'vitest';
import { plainExcerpt } from './excerpt.ts';

describe('plainExcerpt', () => {
  it('entfernt Tags und fasst Leerraum zusammen', () => {
    expect(
      plainExcerpt('<p>Hallo <strong>Welt</strong></p>\n<p>zwei</p>'),
    ).toBe('Hallo Welt zwei');
  });

  it('lässt Skripte, Stile, Code-Blöcke und Bilder nicht in den Text', () => {
    const html =
      '<p>vorn</p><script>alert(1)</script><style>p{}</style><pre><code>x = 1</code></pre><img alt="Bild" src="/a.webp"><p>hinten</p>';
    expect(plainExcerpt(html)).toBe('vorn hinten');
  });

  it('löst Entitäten auf und kodiert nichts neu', () => {
    expect(
      plainExcerpt('<p>a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39;</p>'),
    ).toBe('a & b <c> "d" \'e\'');
  });

  it('kürzt an der Wortgrenze mit Auslassungszeichen', () => {
    const text = '<p>' + 'wort '.repeat(100) + '</p>';
    const ergebnis = plainExcerpt(text, 24);
    expect(ergebnis).toBe('wort wort wort wort…');
    expect(ergebnis.length).toBeLessThanOrEqual(24);
  });

  it('kürzt ein einzelnes langes Wort hart', () => {
    const ergebnis = plainExcerpt('<p>' + 'x'.repeat(100) + '</p>', 10);
    expect(ergebnis).toBe('xxxxxxxxx…');
  });

  it('lässt kurze Texte unverändert', () => {
    expect(plainExcerpt('<p>kurz</p>', 200)).toBe('kurz');
  });

  it('liefert leeren Text für leeres HTML', () => {
    expect(plainExcerpt('')).toBe('');
    expect(plainExcerpt('<img src="/a.webp">')).toBe('');
  });
});
