export interface MatomoConfig {
  /** Address of the Matomo instance, ending with `/`. */
  base: string;
  siteId: string;
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
  if (raw === '')
    throw new Error('MATOMO_SITE_ID is set, but MATOMO_URL is not');
  if (siteId === '')
    throw new Error('MATOMO_URL is set, but MATOMO_SITE_ID is not');

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`MATOMO_URL is not an address: ${raw}`);
  }
  const hasPath = url.pathname !== '/';
  const valid =
    (url.protocol === 'https:' || url.protocol === 'http:') &&
    url.username === '' &&
    url.password === '' &&
    url.search === '' &&
    url.hash === '' &&
    !raw.includes('?') &&
    !raw.includes('#') &&
    (!hasPath || raw.endsWith('/'));
  if (!valid) {
    throw new Error(
      `MATOMO_URL must be like https://stats.example.org or https://example.org/matomo/ (a path ends with /, no query or login): ${raw}`,
    );
  }
  if (!/^[1-9][0-9]{0,8}$/.test(siteId)) {
    throw new Error(
      `MATOMO_SITE_ID must be a positive whole number: ${siteId}`,
    );
  }
  return { base: url.href.endsWith('/') ? url.href : `${url.href}/`, siteId };
}

/** The tracker commands, without cookies (decided by the owner). */
export function matomoCommands(config: MatomoConfig): unknown[][] {
  return [
    ['disableCookies'],
    ['setTrackerUrl', `${config.base}matomo.php`],
    ['setSiteId', config.siteId],
    ['trackPageView'],
    ['enableLinkTracking'],
  ];
}
