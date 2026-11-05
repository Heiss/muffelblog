import { hasExtras, isHttp, tryUrl } from '@muffelblog/core';
import type { MatomoConfig } from './matomo-commands';

export { matomoCommands, type MatomoConfig } from './matomo-commands';

/** An address the Content Security Policy can name exactly: an origin, or a path ending with `/`. */
function csPolicySafe(url: URL, raw: string): boolean {
  if (!isHttp(url) || hasExtras(url)) return false;
  if (raw.includes('?') || raw.includes('#')) return false;
  return url.pathname === '/' || raw.endsWith('/');
}

function requireBoth(raw: string, siteId: string): void {
  if (raw === '')
    throw new Error('MATOMO_SITE_ID is set, but MATOMO_URL is not');
  if (siteId === '')
    throw new Error('MATOMO_URL is set, but MATOMO_SITE_ID is not');
}

function matomoUrl(raw: string): URL {
  const url = tryUrl(raw);
  if (url === null) throw new Error(`MATOMO_URL is not an address: ${raw}`);
  if (!csPolicySafe(url, raw)) {
    throw new Error(
      `MATOMO_URL must be like https://stats.example.org or https://example.org/matomo/ (a path ends with /, no query or login): ${raw}`,
    );
  }
  return url;
}

/**
 * Statistics with the operator's own Matomo: on only when `MATOMO_URL` and
 * `MATOMO_SITE_ID` are set. The address goes into the Content Security Policy
 * as it is, so it must be an origin or a path that ends with `/`. An invalid or
 * half configuration stops the build.
 */
export function matomoConfig(
  env: Record<string, string | undefined> = process.env,
): MatomoConfig | undefined {
  const raw = env.MATOMO_URL?.trim() ?? '';
  const siteId = env.MATOMO_SITE_ID?.trim() ?? '';
  if (raw === '' && siteId === '') return undefined;
  requireBoth(raw, siteId);
  const url = matomoUrl(raw);
  if (!/^[1-9][0-9]{0,8}$/.test(siteId)) {
    throw new Error(
      `MATOMO_SITE_ID must be a positive whole number: ${siteId}`,
    );
  }
  return { base: url.href.endsWith('/') ? url.href : `${url.href}/`, siteId };
}
