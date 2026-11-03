export interface Theme {
  id: string;
  label: string;
  /** Dark theme: serves as the counterpart for a dark system setting. */
  dark: boolean;
}

/** Order in the switcher. The colors live in `styles/themes.css`. */
export const THEMES: readonly Theme[] = [
  { id: 'solarized-light', label: 'Solarized Light', dark: false },
  { id: 'hell', label: 'Hell', dark: false },
  { id: 'solarized-dark', label: 'Solarized Dark', dark: true },
  { id: 'dracula', label: 'Dracula', dark: true },
  { id: 'matrix', label: 'Matrix', dark: true },
  { id: 'nord', label: 'Nord', dark: true },
  { id: 'gruvbox', label: 'Gruvbox', dark: true },
  { id: 'monokai', label: 'Monokai', dark: true },
  { id: 'tokyo-night', label: 'Tokyo Night', dark: true },
  { id: 'catppuccin', label: 'Catppuccin Mocha', dark: true },
];

export const DEFAULT_LIGHT = 'solarized-light';
export const DEFAULT_DARK = 'solarized-dark';
export const THEME_STORAGE_KEY = 'muffel:theme';

export function isThemeId(value: unknown): value is string {
  return typeof value === 'string' && THEMES.some((t) => t.id === value);
}

/** A stored choice wins, otherwise the theme follows the system setting. */
export function pickTheme(
  stored: string | null | undefined,
  systemDark: boolean,
): string {
  if (isThemeId(stored)) return stored;
  return systemDark ? DEFAULT_DARK : DEFAULT_LIGHT;
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m?.[1]) throw new Error(`Not a color in the format #rrggbb: ${hex}`);
  const n = parseInt(m[1], 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

/** Contrast ratio according to WCAG 2.x, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

/** Readable source of the script that sets `data-theme` before the first paint. */
export function themeInitScript(): string {
  const ids = JSON.stringify(THEMES.map((t) => t.id));
  return (
    `(function(){var ids=${ids},t=null;` +
    `try{t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});}catch(e){}` +
    `if(ids.indexOf(t)<0){t=window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?${JSON.stringify(DEFAULT_DARK)}:${JSON.stringify(DEFAULT_LIGHT)};}` +
    `document.documentElement.setAttribute("data-theme",t);})();\n`
  );
}
