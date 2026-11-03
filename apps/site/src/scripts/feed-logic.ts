export type Filter = 'all' | 'post' | 'memo';

const PATHS: Record<Filter, string> = {
  all: '/',
  post: '/posts/',
  memo: '/memos/',
};

export function parseFilter(raw: string | null | undefined): Filter {
  return raw === 'post' || raw === 'memo' || raw === 'all' ? raw : 'all';
}

/** First page of the series from which a filter takes its entries. */
export function seriesPath(filter: Filter): string {
  return PATHS[filter];
}

// Blocks of the own site: a base, optionally followed by `page/N/` with N >= 2.
const BLOCK =
  /^\/(?:(?:memos|posts)\/|tag\/[a-z0-9]+(?:-[a-z0-9]+)*\/)?(?:page\/(?:[2-9]|[1-9]\d+)\/)?$/;

/**
 * Checks whether an address is a block of the own site and then returns the
 * path. Everything else (foreign origin, other pages, query parts) is rejected
 * before anything is loaded.
 */
export function blockPath(raw: string, origin: string): string | null {
  if (raw === '' || raw.startsWith('//')) return null;
  let url: URL;
  try {
    url = new URL(raw, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin || url.search !== '' || url.hash !== '')
    return null;
  if (raw.includes('?') || raw.includes('#')) return null;
  // Only unchanged paths: `/../x/` would otherwise be silently rewritten.
  const expected = raw.startsWith('/') ? raw : raw.slice(origin.length);
  if (url.pathname !== expected) return null;
  return BLOCK.test(url.pathname) ? url.pathname : null;
}

/** Identifiers that are not in the list yet, without duplicates, in order. */
export function freshIds(
  existing: ReadonlySet<string>,
  ids: string[],
): string[] {
  const seen = new Set(existing);
  const fresh: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    fresh.push(id);
  }
  return fresh;
}
