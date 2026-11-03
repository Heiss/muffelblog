import { describe, expect, it } from 'vitest';
import { excerptParts, searchFilters, summaryText } from './search-logic';

describe('excerptParts', () => {
  it('splits text and marks', () => {
    expect(excerptParts('Ein <mark>Cache</mark> hält')).toEqual([
      { text: 'Ein ', mark: false },
      { text: 'Cache', mark: true },
      { text: ' hält', mark: false },
    ]);
  });

  it('drops other tags, the result is text only', () => {
    const parts = excerptParts('<img src=x onerror=alert(1)><mark>a</mark>b');
    expect(parts).toEqual([
      { text: 'a', mark: true },
      { text: 'b', mark: false },
    ]);
  });

  it('keeps escaped markup as text', () => {
    expect(excerptParts('&lt;b&gt; <mark>x</mark>')).toEqual([
      { text: '<b> ', mark: false },
      { text: 'x', mark: true },
    ]);
  });

  it('decodes entities', () => {
    expect(excerptParts('a &amp; b')).toEqual([{ text: 'a & b', mark: false }]);
  });

  it('handles empty input', () => {
    expect(excerptParts('')).toEqual([]);
  });
});

describe('searchFilters', () => {
  it('uses only chosen values', () => {
    expect(searchFilters('', '')).toEqual({});
    expect(searchFilters('Lang', '')).toEqual({ kind: 'Lang' });
    expect(searchFilters('', 'it')).toEqual({ tag: 'it' });
    expect(searchFilters('Kurz', 'it')).toEqual({ kind: 'Kurz', tag: 'it' });
  });
});

describe('summaryText', () => {
  const t = {
    none: 'keine „{term}“',
    one: '1 für „{term}“',
    many: '{count} für „{term}“',
  };
  it('picks the form by count', () => {
    expect(summaryText(t, 0, 'x')).toBe('keine „x“');
    expect(summaryText(t, 1, 'x')).toBe('1 für „x“');
    expect(summaryText(t, 5, 'x')).toBe('5 für „x“');
  });
});
