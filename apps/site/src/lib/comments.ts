export interface CommentsConfig {
  /** Origin of the Remark42 server as the visitor's browser reaches it. */
  host: string;
  siteId: string;
}

const DEFAULT_SITE_ID = 'muffelblog';

/**
 * Comments are on only when `COMMENTS_URL` is set. An invalid value stops the
 * build, so a typo never ships a page that loads scripts from a wrong host.
 */
export function commentsConfig(
  env: Record<string, string | undefined> = process.env,
): CommentsConfig | undefined {
  const raw = env.COMMENTS_URL?.trim();
  if (!raw) return undefined;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`COMMENTS_URL is not an address: ${raw}`);
  }
  const plainOrigin =
    (url.protocol === 'https:' || url.protocol === 'http:') &&
    url.username === '' &&
    url.password === '' &&
    (url.pathname === '/' || url.pathname === '') &&
    url.search === '' &&
    url.hash === '';
  if (!plainOrigin) {
    throw new Error(
      `COMMENTS_URL must be an origin like https://comments.example.org (no path, query or login): ${raw}`,
    );
  }

  const siteId = env.COMMENTS_SITE_ID?.trim() || DEFAULT_SITE_ID;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(siteId)) {
    throw new Error(
      `COMMENTS_SITE_ID may only contain letters, digits, - and _: ${siteId}`,
    );
  }
  return { host: url.origin, siteId };
}
