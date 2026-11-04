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

export function createAdminClient(options: AdminOptions) {
  if (!options.password) {
    throw new Error(
      'REMARK_ADMIN_PASSWD is missing (the administrator login of Remark42)',
    );
  }
  let base: URL;
  try {
    base = new URL(options.baseUrl);
  } catch {
    throw new Error(
      `REMARK_INTERNAL_URL is not an address: ${options.baseUrl}`,
    );
  }
  const root = `${base.origin}${base.pathname.replace(/\/+$/, '')}`;
  const doFetch = options.fetch ?? globalThis.fetch;
  const auth = `Basic ${Buffer.from(`admin:${options.password}`).toString('base64')}`;

  function endpoint(
    path: string,
    params: Record<string, string | undefined> = {},
  ): string {
    const url = new URL(`${root}${path}`);
    url.searchParams.set('site', options.site);
    for (const [k, v] of Object.entries(params))
      if (v !== undefined) url.searchParams.set(k, v);
    return url.href;
  }

  async function call(
    method: string,
    url: string,
    body?: Uint8Array<ArrayBuffer>,
  ): Promise<Response> {
    let res: Response;
    try {
      res = await doFetch(url, {
        method,
        headers: { Authorization: auth, Accept: 'application/json' },
        ...(body ? { body: new Blob([body]) } : {}),
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

  return {
    async list(limit: number): Promise<AdminComment[]> {
      const res = await call('GET', endpoint(`/api/v1/last/${limit}`));
      return (await res.json()) as AdminComment[];
    },
    async deleteComment(id: string, pageUrl: string): Promise<void> {
      await call(
        'DELETE',
        endpoint(`/api/v1/admin/comment/${encodeURIComponent(id)}`, {
          url: pageUrl,
        }),
      );
    },
    async block(userId: string, ttl?: string): Promise<void> {
      await call(
        'PUT',
        endpoint(`/api/v1/admin/user/${encodeURIComponent(userId)}`, {
          block: '1',
          ttl,
        }),
      );
    },
    async unblock(userId: string): Promise<void> {
      await call(
        'PUT',
        endpoint(`/api/v1/admin/user/${encodeURIComponent(userId)}`, {
          block: '0',
        }),
      );
    },
    async exportAll(): Promise<Uint8Array<ArrayBuffer>> {
      const res = await call(
        'GET',
        endpoint('/api/v1/admin/export', { mode: 'file' }),
      );
      return new Uint8Array(await res.arrayBuffer());
    },
    async importAll(data: Uint8Array<ArrayBuffer>): Promise<void> {
      await call('POST', endpoint('/api/v1/admin/import'), data);
      await call('GET', endpoint('/api/v1/admin/wait'));
    },
  };
}

/** One readable line per comment: id, time, author, page and the start of the text. */
export function formatComment(c: AdminComment): string {
  const plain = c.text
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  const short = plain.length > 120 ? `${plain.slice(0, 117)}...` : plain;
  return `${c.id}  ${c.time}  ${c.user.name} (${c.user.id})  ${c.locator.url}\n    ${short}`;
}
