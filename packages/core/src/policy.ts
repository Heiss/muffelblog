/**
 * Policy for third-party content in articles.
 *
 * The site loads nothing else from foreign servers. Articles may use exactly
 * these image hosts and embeds. Memo images are exempt, they are mirrored to
 * the own domain.
 * The same lists will later feed the Content Security Policy of the server.
 */

/** Hosts from which articles may load remote images (https only). */
export const ALLOWED_IMAGE_HOSTS = [
  'upload.wikimedia.org',
  'raw.githubusercontent.com',
  'user-images.githubusercontent.com',
] as const;

export interface EmbedRule {
  host: string;
  label: string;
  /** Allowed path of the embed URL, without parameters. */
  path: RegExp;
  /** URL under which the content opens on the original site. */
  openUrl: (url: URL) => string;
}

export const EMBED_RULES: readonly EmbedRule[] = [
  {
    host: 'www.youtube-nocookie.com',
    label: 'YouTube',
    path: /^\/embed\/[A-Za-z0-9_-]{11}$/,
    openUrl: (url) =>
      `https://www.youtube.com/watch?v=${url.pathname.split('/').pop() ?? ''}`,
  },
];

function parseHttps(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username !== '' || url.password !== '' || url.port !== '')
    return null;
  return url;
}

/** Is this an https image from an allowed host? */
export function isAllowedImageUrl(value: string): boolean {
  const url = parseHttps(value);
  if (url === null) return false;
  return (ALLOWED_IMAGE_HOSTS as readonly string[]).includes(url.hostname);
}

export interface EmbedMatch {
  label: string;
  /** The checked, normalized embed URL. */
  src: string;
  openUrl: string;
}

/**
 * Checks an embed URL strictly against the rules: https, exact host, exact
 * path, no parameters, no credentials. Anything else returns null.
 */
export function matchEmbed(value: string): EmbedMatch | null {
  const url = parseHttps(value.trim());
  if (url === null) return null;
  // The URL must already have been normalized (no ../, no re-encoding).
  if (url.href !== value.trim()) return null;
  if (url.search !== '' || url.hash !== '') return null;
  for (const rule of EMBED_RULES) {
    if (url.hostname === rule.host && rule.path.test(url.pathname)) {
      return { label: rule.label, src: url.href, openUrl: rule.openUrl(url) };
    }
  }
  return null;
}
