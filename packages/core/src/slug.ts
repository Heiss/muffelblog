const UMLAUTE: Record<string, string> = {
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
 * Macht aus einem Text eine URL-taugliche Kennung: klein, ASCII, Bindestriche.
 * Umlaute werden zu ae, oe, ue, ss; andere Akzente fallen weg.
 * Liefert null, wenn nichts Brauchbares übrig bleibt.
 */
export function toSlug(input: string): string | null {
  // NFC zuerst: macOS und manche Sync-Werkzeuge liefern zerlegte Umlaute (a + ¨).
  const composed = input.normalize('NFC');
  const ersetzt = composed.replace(
    /[äöüßÄÖÜẞ]/g,
    (zeichen) => UMLAUTE[zeichen] ?? zeichen,
  );
  const ohneAkzente = ersetzt.normalize('NFKD').replace(/\p{M}+/gu, '');
  const slug = ohneAkzente
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? null : slug;
}

/**
 * Anzeigeform eines Tags: klein, ohne führendes `#`, Leerraum zusammengefasst.
 * Liefert null für leere Tags.
 */
export function normalizeTag(tag: string): string | null {
  const bereinigt = tag
    .normalize('NFC')
    .trim()
    .replace(/^#+/, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  return bereinigt === '' ? null : bereinigt;
}

/** URL-Form eines Tags, zum Beispiel für `/tag/<tag>/`. */
export function tagSlug(tag: string): string | null {
  return toSlug(tag);
}
