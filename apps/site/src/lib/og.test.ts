import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { OG_HEIGHT, OG_WIDTH, ogImagePath, renderOgCard, shorten } from './og';

describe('ogImagePath', () => {
  it('maps posts, memos and terms to their image', () => {
    expect(ogImagePath('/p/hello/')).toBe('/og/p/hello.png');
    expect(ogImagePath('/m/abc/')).toBe('/og/m/abc.png');
    expect(ogImagePath('/g/cache/')).toBe('/og/g/cache.png');
  });

  it('has no image for other pages', () => {
    for (const url of ['/', '/glossary/', '/impressum/', '/p/'])
      expect(ogImagePath(url), url).toBeUndefined();
  });
});

describe('shorten', () => {
  it('keeps short texts', () => {
    expect(shorten('  Hallo   Welt ', 20)).toBe('Hallo Welt');
  });

  it('cuts at a word boundary with an ellipsis', () => {
    const s = shorten('eins zwei drei vier fünf sechs', 16);
    expect(s).toBe('eins zwei drei…');
    expect(s.length).toBeLessThanOrEqual(16);
  });
});

describe('renderOgCard', () => {
  it('renders a PNG of 1200 x 630 with umlauts and a long title', async () => {
    const png = await renderOgCard({
      siteName: 'Muffelblog',
      kindLabel: 'Post',
      title:
        'Größe und Maße – ein sehr langer Titel, der auf mehrere Zeilen umbrechen muss, damit er passt',
      date: '5 November 2026',
      excerpt: 'Ein kurzer Auszug mit Ümläuten.',
    });
    const meta = await sharp(png).metadata();
    expect(meta.format).toBe('png');
    expect([meta.width, meta.height]).toEqual([OG_WIDTH, OG_HEIGHT]);
  });
});
