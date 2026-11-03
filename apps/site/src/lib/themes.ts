export interface Theme {
  id: string;
  label: string;
  /** Dunkles Theme: dient als Gegenstück bei dunkler Systemeinstellung. */
  dark: boolean;
}

/** Reihenfolge im Umschalter. Die Farben stehen in `styles/themes.css`. */
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

export function isThemeId(wert: unknown): wert is string {
  return typeof wert === 'string' && THEMES.some((t) => t.id === wert);
}

/** Gespeicherte Wahl gewinnt, sonst folgt das Theme der Systemeinstellung. */
export function pickTheme(
  gespeichert: string | null | undefined,
  systemDunkel: boolean,
): string {
  if (isThemeId(gespeichert)) return gespeichert;
  return systemDunkel ? DEFAULT_DARK : DEFAULT_LIGHT;
}

function kanal(wert: number): number {
  const c = wert / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminanz(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m?.[1]) throw new Error(`Keine Farbe im Format #rrggbb: ${hex}`);
  const n = parseInt(m[1], 16);
  return (
    0.2126 * kanal((n >> 16) & 255) +
    0.7152 * kanal((n >> 8) & 255) +
    0.0722 * kanal(n & 255)
  );
}

/** Kontrastverhältnis nach WCAG 2.x, 1 bis 21. */
export function contrastRatio(a: string, b: string): number {
  const [hell, dunkel] = [luminanz(a), luminanz(b)].sort((x, y) => y - x);
  return ((hell ?? 0) + 0.05) / ((dunkel ?? 0) + 0.05);
}

/** Lesbarer Quelltext des Skripts, das `data-theme` vor dem ersten Zeichnen setzt. */
export function themeInitScript(): string {
  const ids = JSON.stringify(THEMES.map((t) => t.id));
  return (
    `(function(){var ids=${ids},t=null;` +
    `try{t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});}catch(e){}` +
    `if(ids.indexOf(t)<0){t=window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?${JSON.stringify(DEFAULT_DARK)}:${JSON.stringify(DEFAULT_LIGHT)};}` +
    `document.documentElement.setAttribute("data-theme",t);})();\n`
  );
}
