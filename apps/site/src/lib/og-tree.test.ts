import { describe, expect, it } from 'vitest';
import { cardTree, shorten } from './og';

// The layout of the preview card is fixed: a change of colors, sizes or
// texts must be a deliberate change of this snapshot.

describe('cardTree', () => {
  it('lays out a card with a short title and an excerpt', () => {
    expect(
      cardTree({
        siteName: 'Blog',
        kindLabel: 'Post',
        title: 'Hello',
        date: '1 Jan 2026',
        excerpt: 'A short   text',
      }),
    ).toMatchSnapshot();
  });

  it('uses the smaller font for a long title and leaves out an empty excerpt', () => {
    const tree = JSON.stringify(
      cardTree({
        siteName: 'Blog',
        kindLabel: 'Term',
        title: 'x'.repeat(61),
        date: '2 Jan 2026',
      }),
    );
    expect(tree).toContain('"fontSize":54');
    expect(tree).not.toContain('"fontSize":68');
    const exact = JSON.stringify(
      cardTree({
        siteName: 'Blog',
        kindLabel: 'Term',
        title: 'x'.repeat(60),
        date: '2 Jan 2026',
        excerpt: '',
      }),
    );
    expect(exact).toContain('"fontSize":68');
    expect(exact.match(/"children":\[/g)?.length).toBe(
      tree.match(/"children":\[/g)?.length,
    );
  });
});

describe('shorten: borders', () => {
  it('keeps a text of exactly max characters', () => {
    expect(shorten('abcde', 5)).toBe('abcde');
    expect(shorten('abcdef', 5)).toBe('abcd…');
  });

  it('cuts at a space only in the second half', () => {
    expect(shorten('abcdef ghij', 10)).toBe('abcdef…');
    expect(shorten('abcde fghij', 10)).toBe('abcde fgh…');
    expect(shorten('ab cdefghij', 10)).toBe('ab cdefgh…');
  });
});
