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

function variablen(id: string): Record<string, string> {
  const treffer = new RegExp(
    `\\[data-theme=["']${id}["']\\]\\s*\\{([^}]*)\\}`,
  ).exec(css);
  if (!treffer?.[1]) throw new Error(`Kein Block für Theme ${id}`);
  const ergebnis: Record<string, string> = {};
  for (const zeile of treffer[1].split(';')) {
    const m = /^\s*--([a-z0-9-]+)\s*:\s*(.+?)\s*$/s.exec(zeile);
    if (m?.[1] && m[2]) ergebnis[m[1]] = m[2];
  }
  return ergebnis;
}

describe('contrastRatio', () => {
  it('kennt die Eckwerte', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5);
  });

  it('ist symmetrisch', () => {
    expect(contrastRatio('#123456', '#fedcba')).toBeCloseTo(
      contrastRatio('#fedcba', '#123456'),
      10,
    );
  });

  it('lehnt andere Formate ab', () => {
    expect(() => contrastRatio('red', '#fff')).toThrow();
    expect(() => contrastRatio('#fff', '#000000')).toThrow();
  });
});

describe('pickTheme', () => {
  it('nimmt die gespeicherte Wahl', () => {
    expect(pickTheme('nord', false)).toBe('nord');
    expect(pickTheme('nord', true)).toBe('nord');
  });

  it('folgt ohne Wahl der Systemeinstellung', () => {
    expect(pickTheme(null, false)).toBe(DEFAULT_LIGHT);
    expect(pickTheme(undefined, true)).toBe(DEFAULT_DARK);
  });

  it('ignoriert unbekannte Werte', () => {
    for (const roh of ['', 'Nord', 'rot', '__proto__', '{"a":1}']) {
      expect(pickTheme(roh, false)).toBe(DEFAULT_LIGHT);
    }
  });

  it('hat Solarized Light als hellen und Solarized Dark als dunklen Standard', () => {
    expect(DEFAULT_LIGHT).toBe('solarized-light');
    expect(DEFAULT_DARK).toBe('solarized-dark');
    expect(THEMES.find((t) => t.id === DEFAULT_DARK)?.dark).toBe(true);
    expect(THEMES.find((t) => t.id === DEFAULT_LIGHT)?.dark).toBe(false);
  });
});

describe('THEMES', () => {
  it('sind zehn mit eindeutigen Kennungen', () => {
    expect(THEMES).toHaveLength(10);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(10);
    for (const t of THEMES) expect(isThemeId(t.id)).toBe(true);
  });

  it('haben jeweils genau einen Block in themes.css, und es gibt keinen weiteren', () => {
    const ids = [...css.matchAll(/\[data-theme=["']([a-z-]+)["']\]\s*\{/g)].map(
      (m) => m[1],
    );
    expect(ids.sort()).toEqual(THEMES.map((t) => t.id).sort());
  });
});

describe('Kontrast je Theme (Text mindestens 4,5:1)', () => {
  const paare: [string, string][] = [
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
      const v = variablen(theme.id);
      for (const [vorn, hinten] of paare) {
        const a = v[vorn];
        const b = v[hinten];
        expect(a, `${theme.id}: --${vorn} fehlt`).toBeDefined();
        expect(b, `${theme.id}: --${hinten} fehlt`).toBeDefined();
        const verhaeltnis = contrastRatio(a as string, b as string);
        expect(
          verhaeltnis,
          `${theme.id}: --${vorn} auf --${hinten} = ${verhaeltnis.toFixed(2)}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${theme.label}: hat alle Gestaltungsvariablen`, () => {
      const v = variablen(theme.id);
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
        expect(v[name], `${theme.id}: --${name} fehlt`).toBeDefined();
      }
      expect(v['color-scheme']).toBe(theme.dark ? 'dark' : 'light');
    });
  }
});

describe('themeInitScript', () => {
  it('ist ein kurzer, in sich geschlossener Text ohne Fremdadressen', () => {
    const js = themeInitScript();
    expect(js.length).toBeLessThan(800);
    expect(js).not.toMatch(/https?:/);
    for (const t of THEMES) expect(js).toContain(`"${t.id}"`);
  });

  it('setzt data-theme nach denselben Regeln wie pickTheme', () => {
    const run = (gespeichert: string | null, dunkel: boolean) => {
      const attrs: Record<string, string> = {};
      const sandbox = {
        localStorage: { getItem: () => gespeichert },
        matchMedia: () => ({ matches: dunkel }),
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

  it('übersteht einen gesperrten Speicher', () => {
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
