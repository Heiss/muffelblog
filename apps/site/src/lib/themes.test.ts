import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DARK,
  DEFAULT_LIGHT,
  THEMES,
  contrastRatio,
  isThemeId,
  pickTheme,
  themeInitScript,
} from './themes';

const css = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'styles',
    'themes.css',
  ),
  'utf8',
);

function variables(id: string): Record<string, string> {
  const match = new RegExp(
    `\\[data-theme=["']${id}["']\\]\\s*\\{([^}]*)\\}`,
  ).exec(css);
  if (!match?.[1]) throw new Error(`No block for theme ${id}`);
  const result: Record<string, string> = {};
  for (const line of match[1].split(';')) {
    const m = /^\s*--([a-z0-9-]+)\s*:\s*(.+?)\s*$/s.exec(line);
    if (m?.[1] && m[2]) result[m[1]] = m[2];
  }
  return result;
}

describe('contrastRatio', () => {
  it('knows the corner values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#123456', '#fedcba')).toBeCloseTo(
      contrastRatio('#fedcba', '#123456'),
      10,
    );
  });

  it('rejects other formats', () => {
    expect(() => contrastRatio('red', '#fff')).toThrow();
    expect(() => contrastRatio('#fff', '#000000')).toThrow();
  });
});

describe('pickTheme', () => {
  it('takes the stored choice', () => {
    expect(pickTheme('nord', false)).toBe('nord');
    expect(pickTheme('nord', true)).toBe('nord');
  });

  it('follows the system setting without a choice', () => {
    expect(pickTheme(null, false)).toBe(DEFAULT_LIGHT);
    expect(pickTheme(undefined, true)).toBe(DEFAULT_DARK);
  });

  it('ignores unknown values', () => {
    for (const roh of ['', 'Nord', 'rot', '__proto__', '{"a":1}']) {
      expect(pickTheme(roh, false)).toBe(DEFAULT_LIGHT);
    }
  });

  it('has Solarized Light as the light and Solarized Dark as the dark default', () => {
    expect(DEFAULT_LIGHT).toBe('solarized-light');
    expect(DEFAULT_DARK).toBe('solarized-dark');
    expect(THEMES.find((t) => t.id === DEFAULT_DARK)?.dark).toBe(true);
    expect(THEMES.find((t) => t.id === DEFAULT_LIGHT)?.dark).toBe(false);
  });
});

describe('THEMES', () => {
  it('are ten with unique identifiers', () => {
    expect(THEMES).toHaveLength(10);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(10);
    for (const t of THEMES) expect(isThemeId(t.id)).toBe(true);
  });

  it('each have exactly one block in themes.css, and there is no other', () => {
    const ids = [...css.matchAll(/\[data-theme=["']([a-z-]+)["']\]\s*\{/g)].map(
      (m) => m[1],
    );
    expect(ids.sort()).toEqual(THEMES.map((t) => t.id).sort());
  });
});

describe('Contrast per theme (text at least 4.5:1)', () => {
  const pairs: [string, string][] = [
    ['fg', 'bg'],
    ['fg', 'panel'],
    ['fg', 'tint'],
    ['dim', 'bg'],
    ['dim', 'panel'],
    ['dim', 'tint'],
    ['ac', 'bg'],
    ['ac', 'panel'],
    ['on-ac', 'ac'],
    ['tok-keyword', 'panel'],
    ['tok-string', 'panel'],
    ['tok-comment', 'panel'],
    ['tok-number', 'panel'],
    ['tok-title', 'panel'],
    ['tok-type', 'panel'],
  ];

  for (const theme of THEMES) {
    it(`${theme.label}`, () => {
      const v = variables(theme.id);
      for (const [first, second] of pairs) {
        const a = v[first];
        const b = v[second];
        expect(a, `${theme.id}: --${first} is missing`).toBeDefined();
        expect(b, `${theme.id}: --${second} is missing`).toBeDefined();
        const ratio = contrastRatio(a as string, b as string);
        expect(
          ratio,
          `${theme.id}: --${first} on --${second} = ${ratio.toFixed(2)}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${theme.label}: has all design variables`, () => {
      const v = variables(theme.id);
      for (const name of [
        'bg',
        'panel',
        'line',
        'fg',
        'dim',
        'ac',
        'on-ac',
        'tint',
        'radius',
        'pill',
        'font-body',
        'font-head',
        'font-meta',
        'color-scheme',
      ]) {
        expect(v[name], `${theme.id}: --${name} is missing`).toBeDefined();
      }
      expect(v['color-scheme']).toBe(theme.dark ? 'dark' : 'light');
    });
  }
});

describe('themeInitScript', () => {
  it('is a short, self-contained text without foreign addresses', () => {
    const js = themeInitScript();
    expect(js.length).toBeLessThan(800);
    expect(js).not.toMatch(/https?:/);
    for (const t of THEMES) expect(js).toContain(`"${t.id}"`);
  });

  it('sets data-theme by the same rules as pickTheme', () => {
    const run = (stored: string | null, dark: boolean) => {
      const attrs: Record<string, string> = {};
      const sandbox = {
        localStorage: { getItem: () => stored },
        matchMedia: () => ({ matches: dark }),
        document: {
          documentElement: {
            setAttribute: (k: string, v: string) => (attrs[k] = v),
          },
        },
      };
      new Function(
        'window',
        'localStorage',
        'matchMedia',
        'document',
        themeInitScript(),
      )(sandbox, sandbox.localStorage, sandbox.matchMedia, sandbox.document);
      return attrs['data-theme'];
    };
    for (const g of [null, 'nord', 'unbekannt', '']) {
      for (const d of [false, true]) {
        expect(run(g, d)).toBe(pickTheme(g, d));
      }
    }
  });

  it('survives blocked storage', () => {
    const attrs: Record<string, string> = {};
    const sandbox = {
      localStorage: {
        getItem: () => {
          throw new Error('gesperrt');
        },
      },
      matchMedia: () => ({ matches: true }),
      document: {
        documentElement: {
          setAttribute: (k: string, v: string) => (attrs[k] = v),
        },
      },
    };
    new Function(
      'window',
      'localStorage',
      'matchMedia',
      'document',
      themeInitScript(),
    )(sandbox, sandbox.localStorage, sandbox.matchMedia, sandbox.document);
    expect(attrs['data-theme']).toBe(DEFAULT_DARK);
  });
});
