/** Small checks for addresses that come from settings. */

/** The address, or null when it is none. */
export function tryUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export const isHttp = (url: URL): boolean =>
  url.protocol === 'https:' || url.protocol === 'http:';

/** True when the address carries a login, a query or a fragment. */
export const hasExtras = (url: URL): boolean =>
  url.username !== '' ||
  url.password !== '' ||
  url.search !== '' ||
  url.hash !== '';

/** True for an http(s) origin without path, login, query or fragment. */
export const isPlainOrigin = (url: URL): boolean =>
  isHttp(url) &&
  !hasExtras(url) &&
  (url.pathname === '/' || url.pathname === '');
