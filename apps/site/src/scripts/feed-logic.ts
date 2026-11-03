export type Filter = 'alle' | 'post' | 'memo';

const PFADE: Record<Filter, string> = {
  alle: '/',
  post: '/posts/',
  memo: '/memos/',
};

export function parseFilter(roh: string | null | undefined): Filter {
  return roh === 'post' || roh === 'memo' || roh === 'alle' ? roh : 'alle';
}

/** Erste Seite der Reihe, aus der ein Filter seine Einträge bezieht. */
export function reihePfad(filter: Filter): string {
  return PFADE[filter];
}

// Blöcke der eigenen Seite: Basis, gefolgt von optional `seite/N/` mit N >= 2.
const BLOCK =
  /^\/(?:(?:memos|posts)\/|tag\/[a-z0-9]+(?:-[a-z0-9]+)*\/)?(?:seite\/(?:[2-9]|[1-9]\d+)\/)?$/;

/**
 * Prüft, ob eine Adresse ein Block der eigenen Seite ist, und liefert dann den
 * Pfad. Alles andere (fremde Herkunft, andere Seiten, Anfrage-Teile) wird
 * abgelehnt, bevor etwas geladen wird.
 */
export function blockPfad(roh: string, origin: string): string | null {
  if (roh === '' || roh.startsWith('//')) return null;
  let url: URL;
  try {
    url = new URL(roh, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin || url.search !== '' || url.hash !== '')
    return null;
  if (roh.includes('?') || roh.includes('#')) return null;
  // Nur unveränderte Pfade: `/../x/` würde sonst stillschweigend umgeschrieben.
  const erwartet = roh.startsWith('/') ? roh : roh.slice(origin.length);
  if (url.pathname !== erwartet) return null;
  return BLOCK.test(url.pathname) ? url.pathname : null;
}

/** Kennungen, die noch nicht in der Liste stehen, ohne Doppelte, in Reihenfolge. */
export function frischeIds(
  vorhanden: ReadonlySet<string>,
  ids: string[],
): string[] {
  const gesehen = new Set(vorhanden);
  const neu: string[] = [];
  for (const id of ids) {
    if (gesehen.has(id)) continue;
    gesehen.add(id);
    neu.push(id);
  }
  return neu;
}
