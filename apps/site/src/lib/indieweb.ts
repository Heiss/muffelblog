/**
 * The address where other sites send webmentions to (W14): announced only when
 * receiving is switched on (`MUFFEL_WEBMENTIONS_RECEIVE=1`) and `SITE_URL` is
 * known. webmention.io names the endpoint after the host of the site.
 */
export function webmentionEndpoint(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  if (env.MUFFEL_WEBMENTIONS_RECEIVE?.trim() !== '1') return undefined;
  const site = env.SITE_URL?.trim();
  if (!site) return undefined;
  const api = (
    env.WEBMENTION_IO_URL?.trim() || 'https://webmention.io'
  ).replace(/\/+$/, '');
  return `${api}/${new URL(site).hostname}/webmention`;
}

/**
 * Profiles that confirm the owner of the site (`rel=me`), for the login at
 * webmention.io: `MUFFEL_REL_ME`, separated by commas. Only http(s) and mailto.
 */
export function relMeLinks(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const raw = env.MUFFEL_REL_ME?.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((value) => {
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        throw new Error(`MUFFEL_REL_ME: not an address: ${value}`);
      }
      if (!['https:', 'http:', 'mailto:'].includes(url.protocol))
        throw new Error(
          `MUFFEL_REL_ME: only https, http and mailto are allowed: ${value}`,
        );
      return value;
    });
}
