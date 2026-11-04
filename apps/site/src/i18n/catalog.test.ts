import { DEFAULT_LANG, LANGUAGES } from '@muffelblog/core';
import { describe, expect, it } from 'vitest';
import { DEFAULT_UI_LANG, catalogs, pickMessages } from './catalogs.ts';

/** All paths of a catalog with the kind of value: string, or function with its arity. */
function shape(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [`${prefix}:string`];
  if (typeof value === 'function')
    return [`${prefix}:fn/${(value as (...a: never[]) => unknown).length}`];
  return Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([key, v]) => shape(v, prefix ? `${prefix}.${key}` : key));
}

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function') return [];
  return Object.values(value as Record<string, unknown>).flatMap(strings);
}

describe('message catalogs', () => {
  it('exist for exactly the languages the core accepts, with the same default', () => {
    expect(Object.keys(catalogs).sort()).toEqual([...LANGUAGES].sort());
    expect(DEFAULT_UI_LANG).toBe(DEFAULT_LANG);
  });

  it('have the same keys and the same kinds of values in every language', () => {
    // `theme.names` is a sparse map: only names that differ from the theme label.
    const own = (path: string) => !path.startsWith('theme.names.');
    expect(shape(catalogs.de).filter(own)).toEqual(
      shape(catalogs.en).filter(own),
    );
  });

  it('carry their own language code', () => {
    expect(catalogs.de.lang).toBe('de');
    expect(catalogs.en.lang).toBe('en');
  });

  it('have no empty text', () => {
    for (const lang of LANGUAGES) {
      for (const text of strings(catalogs[lang])) {
        expect(text.trim(), lang).not.toBe('');
      }
    }
  });

  it('keep the placeholders {term} and {count} of the search summary', () => {
    for (const lang of LANGUAGES) {
      const { none, one, many } = catalogs[lang].search.summary;
      expect(none, lang).toContain('{term}');
      expect(one, lang).toContain('{term}');
      expect(many, lang).toContain('{term}');
      expect(many, lang).toContain('{count}');
    }
  });

  it('format the functions into text', () => {
    for (const lang of LANGUAGES) {
      const m = catalogs[lang];
      expect(m.feed.pageOf(2, 5)).toMatch(/2.*5/);
      expect(m.feed.pageTitle('Foo', 3)).toContain('Foo');
      expect(m.tags.heading('x')).toContain('x');
      expect(m.embed.frameTitle('Video')).toContain('Video');
    }
  });
});

describe('pickMessages', () => {
  it('uses English without a value and for an empty value', () => {
    expect(pickMessages('')).toBe(catalogs.en);
    expect(pickMessages('  ')).toBe(catalogs.en);
  });

  it('accepts de and en, in any case', () => {
    expect(pickMessages('de')).toBe(catalogs.de);
    expect(pickMessages(' EN ')).toBe(catalogs.en);
  });

  it('stops for an unknown language, also for names of Object.prototype', () => {
    expect(() => pickMessages('fr')).toThrow(/de, en/);
    expect(() => pickMessages('constructor')).toThrow();
    expect(() => pickMessages('__proto__')).toThrow();
  });
});
