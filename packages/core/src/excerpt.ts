import { DEFAULT_SETTINGS } from './config.ts';

const BENANNT: Record<string, string> = {
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  amp: '&',
};

function entitaeten(text: string): string {
  return text.replace(
    /&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi,
    (treffer, hex?: string, dez?: string, name?: string) => {
      if (name) return BENANNT[name.toLowerCase()] ?? treffer;
      const code = hex ? parseInt(hex, 16) : parseInt(dez ?? '', 10);
      if (!Number.isInteger(code) || code < 32 || code > 0x10ffff)
        return treffer;
      return String.fromCodePoint(code);
    },
  );
}

/**
 * Klartext-Auszug aus bereinigtem HTML: ohne Tags, Skripte, Stile und
 * Code-Blöcke, Leerraum zusammengefasst, höchstens `max` Zeichen
 * (an einer Wortgrenze gekürzt, mit "…").
 */
export function plainExcerpt(
  html: string,
  max = DEFAULT_SETTINGS.feedExcerptChars,
): string {
  const text = entitaeten(
    html
      .replace(/<(script|style|pre)\b[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<[^>]*>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  const kurz = text.slice(0, max - 1);
  const grenze = kurz.lastIndexOf(' ');
  const ende = grenze > 0 ? kurz.slice(0, grenze) : kurz;
  return `${ende.trimEnd()}…`;
}
