import { DEFAULT_SETTINGS } from './config.ts';

const NAMED: Record<string, string> = {
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  amp: '&',
};

function decodeEntities(text: string): string {
  return text.replace(
    /&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi,
    (match, hex?: string, dec?: string, name?: string) => {
      if (name) return NAMED[name.toLowerCase()] ?? match;
      const code = hex ? parseInt(hex, 16) : parseInt(dec ?? '', 10);
      if (!Number.isInteger(code) || code < 32 || code > 0x10ffff) return match;
      return String.fromCodePoint(code);
    },
  );
}

/**
 * Plain-text excerpt from sanitized HTML: without tags, scripts, styles and
 * code blocks, whitespace collapsed, at most `max` characters
 * (cut at a word boundary, with "…").
 */
export function plainExcerpt(
  html: string,
  max = DEFAULT_SETTINGS.feedExcerptChars,
): string {
  const text = decodeEntities(
    html
      .replace(/<(script|style|pre)\b[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<[^>]*>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  const short = text.slice(0, max - 1);
  const boundary = short.lastIndexOf(' ');
  const end = boundary > 0 ? short.slice(0, boundary) : short;
  return `${end.trimEnd()}…`;
}
