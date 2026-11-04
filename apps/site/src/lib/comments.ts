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

export type StaticCommentsConfig =
  | { kind: 'remark42'; baseUrl: string; siteId: string }
  | { kind: 'fixtures'; folder: string };

/**
 * Where the static copy of the comments comes from at build time: Remark42
 * through its internal address (`REMARK_INTERNAL_URL`), the test fixtures with
 * `MUFFEL_FIXTURES=1`, or nowhere. (The demo set can use Remark42 too, so a
 * comment written in the demo shows up in the copy.) The page address is the key of its comments,
 * so the real source needs `SITE_URL`.
 */
export function staticCommentsConfig(
  env: Record<string, string | undefined> = process.env,
): StaticCommentsConfig | undefined {
  if (env.MUFFEL_FIXTURES === '1')
    return { kind: 'fixtures', folder: 'comments' };
  const baseUrl = env.REMARK_INTERNAL_URL?.trim();
  if (!baseUrl) return undefined;
  if (!env.SITE_URL?.trim()) {
    throw new Error(
      'REMARK_INTERNAL_URL needs SITE_URL: the address of a page is the key of its comments',
    );
  }
  const siteId = env.COMMENTS_SITE_ID?.trim() || DEFAULT_SITE_ID;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(siteId)) {
    throw new Error(
      `COMMENTS_SITE_ID may only contain letters, digits, - and _: ${siteId}`,
    );
  }
  return { kind: 'remark42', baseUrl, siteId };
}
