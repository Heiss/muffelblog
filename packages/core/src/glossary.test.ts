import { describe, expect, it } from 'vitest';
import { groupByLetter, letterOf } from './glossary.ts';

describe('letterOf', () => {
  it('uses the first letter in upper case', () => {
    expect(letterOf('Cache')).toBe('C');
    expect(letterOf('agilität')).toBe('A');
  });

  it('puts umlauts under the base letter', () => {
    expect(letterOf('Ärger')).toBe('A');
    expect(letterOf('Überblick')).toBe('U');
    expect(letterOf('Öl')).toBe('O');
  });

  it('puts ß-words and other accents under their base letter', () => {
    expect(letterOf('Éclair')).toBe('E');
    expect(letterOf('ßeta')).toBe('S');
  });

  it('puts digits and special characters under #', () => {
    expect(letterOf('3D-Druck')).toBe('#');
    expect(letterOf('+++')).toBe('#');
    expect(letterOf('')).toBe('#');
  });

  it('skips leading quotes, whitespace and punctuation', () => {
    expect(letterOf('  „Zitat“')).toBe('Z');
    expect(letterOf('*Stern')).toBe('S');
  });

  it('works with decomposed umlauts (NFD)', () => {
    expect(letterOf('Ärger')).toBe('A');
  });
});

describe('groupByLetter', () => {
  const t = (title: string) => ({ title });

  it('groups and sorts by letter, # last, and sorts within a letter', () => {
    const groups = groupByLetter([
      t('Zebra'),
      t('3D'),
      t('Äpfel'),
      t('Adler'),
      t('Anker'),
    ]);
    expect(groups.map((g) => g.letter)).toEqual(['A', 'Z', '#']);
    expect(groups[0]?.items.map((i) => i.title)).toEqual([
      'Adler',
      'Anker',
      'Äpfel',
    ]);
  });

  it('sorts case-insensitively', () => {
    const groups = groupByLetter([t('bar'), t('Baz'), t('Bar2')]);
    expect(groups[0]?.items.map((i) => i.title)).toEqual([
      'bar',
      'Bar2',
      'Baz',
    ]);
  });

  it('returns nothing for no terms', () => {
    expect(groupByLetter([])).toEqual([]);
  });
});
