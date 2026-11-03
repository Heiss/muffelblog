const UMLAUTS: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
  Ä: 'ae',
  Ö: 'oe',
  Ü: 'ue',
  ẞ: 'ss',
};

/**
 * Turns a text into a URL-safe identifier: lowercase, ASCII, hyphens.
 * German umlauts become ae, oe, ue, ss; other accents are dropped.
 * Returns null if nothing usable is left.
 */
export function toSlug(input: string): string | null {
  // NFC first: macOS and some sync tools deliver decomposed umlauts (a + ¨).
  const composed = input.normalize('NFC');
  const replaced = composed.replace(
    /[äöüßÄÖÜẞ]/g,
    (char) => UMLAUTS[char] ?? char,
  );
  const withoutAccents = replaced.normalize('NFKD').replace(/\p{M}+/gu, '');
  const slug = withoutAccents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? null : slug;
}

/**
 * Display form of a tag: lowercase, without a leading `#`, whitespace collapsed.
 * Returns null for empty tags.
 */
export function normalizeTag(tag: string): string | null {
  const cleaned = tag
    .normalize('NFC')
    .trim()
    .replace(/^#+/, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  return cleaned === '' ? null : cleaned;
}

/** URL form of a tag, for example for `/tag/<tag>/`. */
export function tagSlug(tag: string): string | null {
  return toSlug(tag);
}
