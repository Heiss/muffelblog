import { gunzipSync } from 'node:zlib';
import { tryUrl } from '@muffelblog/core';

/** The administrator API of Remark42 (basic auth) for moderation, backup and restore. */
export interface AdminOptions {
  /** Internal address of Remark42 (`REMARK_INTERNAL_URL`). */
  baseUrl: string;
  site: string;
  /** `REMARK_ADMIN_PASSWD`: the administrator login. Never printed. */
  password: string;
  fetch?: typeof fetch;
}

export interface AdminComment {
  id: string;
  text: string;
  user: { name: string; id: string };
  time: string;
  locator: { url: string };
}

/** The connection of the administrator client. */
interface AdminConnection {
  root: string;
  site: string;
  auth: string;
  doFetch: typeof fetch;
}

function adminConnection(options: AdminOptions): AdminConnection {
  if (!options.password) {
    throw new Error(
      'REMARK_ADMIN_PASSWD is missing (the administrator login of Remark42)',
    );
  }
  const base = tryUrl(options.baseUrl);
  if (base === null)
    throw new Error(
      `REMARK_INTERNAL_URL is not an address: ${options.baseUrl}`,
    );
  return {
    root: `${base.origin}${base.pathname.replace(/\/+$/, '')}`,
    site: options.site,
    auth: `Basic ${Buffer.from(`admin:${options.password}`).toString('base64')}`,
    doFetch: options.fetch ?? globalThis.fetch,
  };
}

function endpoint(
  c: AdminConnection,
  path: string,
  params: Record<string, string | undefined> = {},
): string {
  const url = new URL(`${c.root}${path}`);
  url.searchParams.set('site', c.site);
  for (const [k, v] of Object.entries(params))
    if (v !== undefined) url.searchParams.set(k, v);
  return url.href;
}

async function call(
  c: AdminConnection,
  method: string,
  url: string,
  body?: { data: Uint8Array<ArrayBuffer>; type?: string },
): Promise<Response> {
  let res: Response;
  try {
    res = await c.doFetch(url, {
      method,
      headers: {
        Authorization: c.auth,
        Accept: 'application/json',
        ...(body?.type ? { 'Content-Type': body.type } : {}),
      },
      ...(body ? { body: new Blob([body.data]) } : {}),
      redirect: 'manual',
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    throw new Error(
      `Remark42 is unreachable (${error instanceof Error ? error.message : String(error)})`,
      { cause: error },
    );
  }
  if (!res.ok)
    throw new Error(
      `Remark42 answered ${res.status} for ${method} ${new URL(url).pathname}`,
    );
  return res;
}

/** Writes a comment as the administrator (received webmentions). Returns its id. */
async function postComment(
  c: AdminConnection,
  text: string,
  pageUrl: string,
): Promise<string> {
  const data = new TextEncoder().encode(
    JSON.stringify({ text, locator: { site: c.site, url: pageUrl } }),
  );
  const res = await call(c, 'POST', endpoint(c, '/api/v1/comment'), {
    data,
    type: 'application/json',
  });
  const json = (await res.json()) as { id?: unknown };
  if (typeof json.id !== 'string' || json.id === '')
    throw new Error('Remark42 did not return the id of the new comment');
  return json.id;
}

/**
 * The export is gzip, but the importer of Remark42 reads plain JSON and fails
 * on the gzip header (it still answers 202, the error only shows in its log).
 */
async function importAll(
  c: AdminConnection,
  data: Uint8Array<ArrayBuffer>,
): Promise<void> {
  const gzip = data[0] === 0x1f && data[1] === 0x8b;
  const body = gzip ? new Uint8Array(gunzipSync(data)) : data;
  await call(c, 'POST', endpoint(c, '/api/v1/admin/import'), { data: body });
  await call(c, 'GET', endpoint(c, '/api/v1/admin/wait'));
}

const userPath = (userId: string) =>
  `/api/v1/admin/user/${encodeURIComponent(userId)}`;

export function createAdminClient(options: AdminOptions) {
  const c = adminConnection(options);
  return {
    async list(limit: number): Promise<AdminComment[]> {
      const res = await call(c, 'GET', endpoint(c, `/api/v1/last/${limit}`));
      return (await res.json()) as AdminComment[];
    },
    postComment: (text: string, pageUrl: string) =>
      postComment(c, text, pageUrl),
    async deleteComment(id: string, pageUrl: string): Promise<void> {
      const path = `/api/v1/admin/comment/${encodeURIComponent(id)}`;
      await call(c, 'DELETE', endpoint(c, path, { url: pageUrl }));
    },
    async block(userId: string, ttl?: string): Promise<void> {
      await call(c, 'PUT', endpoint(c, userPath(userId), { block: '1', ttl }));
    },
    async unblock(userId: string): Promise<void> {
      await call(c, 'PUT', endpoint(c, userPath(userId), { block: '0' }));
    },
    async exportAll(): Promise<Uint8Array<ArrayBuffer>> {
      const path = '/api/v1/admin/export';
      const res = await call(c, 'GET', endpoint(c, path, { mode: 'file' }));
      return new Uint8Array(await res.arrayBuffer());
    },
    importAll: (data: Uint8Array<ArrayBuffer>) => importAll(c, data),
  };
}

/** One readable line per comment: id, time, author, page and the start of the text. */
export function formatComment(c: AdminComment): string {
  // Entities first, then everything that looks like a tag goes; no `<` or `>`
  // survives, so nothing in the output can become a tag again.
  const plain = c.text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const short = plain.length > 120 ? `${plain.slice(0, 117)}...` : plain;
  return `${c.id}  ${c.time}  ${c.user.name} (${c.user.id})  ${c.locator.url}\n    ${short}`;
}
