export const SITE_NAME = 'Muffelblog';
export const SITE_LANG = 'de';

/** Titel einer Seite: Seitenname, bei gesetztem Titel mit vorangestelltem Titel. */
export function pageTitle(title?: string): string {
  const trimmed = title?.trim();
  return trimmed ? `${trimmed} – ${SITE_NAME}` : SITE_NAME;
}
