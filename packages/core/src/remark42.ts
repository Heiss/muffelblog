import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_SETTINGS } from './config.ts';
import { parseComments } from './comments.ts';
import type { RemarkComment } from './comments.ts';

export interface RemarkSource {
  /** The latest comments of the whole site (used as a change marker). */
  last(
    limit: number,
  ): Promise<{ comments: RemarkComment[]; warnings: string[] }>;
  /** All comments of one page, flat, oldest first. `url` is the address the widget used as the key. */
  find(url: string): Promise<{ comments: RemarkComment[]; warnings: string[] }>;
}

export interface RemarkOptions {
  /** Internal address of Remark42 (`REMARK_INTERNAL_URL`), reachable from the builder. */
  baseUrl: string;
  site: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  /** Pause between tries after a rate limit answer (tests replace it). */
  sleep?: (ms: number) => Promise<void>;
}

function remarkRoot(baseUrl: string): string {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new Error(`REMARK_INTERNAL_URL is not an address: ${baseUrl}`);
  }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') {
    throw new Error(
      `REMARK_INTERNAL_URL must start with http:// or https://: ${baseUrl}`,
    );
  }
  return `${base.origin}${base.pathname.replace(/\/+$/, '')}`;
}

interface RemarkConnection {
  doFetch: typeof fetch;
  timeoutMs: number;
  sleep: (ms: number) => Promise<void>;
}

async function remarkRequest(c: RemarkConnection, url: URL): Promise<Response> {
  try {
    return await c.doFetch(url.href, {
      redirect: 'manual',
      signal: AbortSignal.timeout(c.timeoutMs),
      headers: { accept: 'application/json' },
    });
  } catch (error) {
    throw new Error(
      `Remark42 is unreachable (${error instanceof Error ? error.message : String(error)})`,
      { cause: error },
    );
  }
}

/** The pause after an answer 429: as told by Retry-After (at most 10 s), else growing. */
function retryDelay(res: Response, attempt: number): number {
  const told = Number(res.headers.get('retry-after'));
  return Number.isFinite(told) && told > 0
    ? Math.min(told, 10) * 1000
    : 1000 * attempt;
}

async function remarkGet(c: RemarkConnection, url: URL) {
  // Remark42 limits the request rate (429): wait as told and try again.
  let res = await remarkRequest(c, url);
  for (let attempt = 1; res.status === 429 && attempt <= 4; attempt += 1) {
    await c.sleep(retryDelay(res, attempt));
    res = await remarkRequest(c, url);
  }
  if (!res.ok)
    throw new Error(`Remark42 answered ${res.status} for ${url.pathname}`);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error('Unexpected answer of Remark42 (not JSON)');
  }
  return parseComments(json);
}

/**
 * Reads comments through the public API of Remark42; no login is needed. Any
 * error (server down, wrong answer) is thrown, never turned into "no comments",
 * so the build stops and the last good version stays online.
 */
export function createRemarkSource(options: RemarkOptions): RemarkSource {
  const root = remarkRoot(options.baseUrl);
  const c: RemarkConnection = {
    doFetch: options.fetch ?? globalThis.fetch,
    timeoutMs: options.timeoutMs ?? DEFAULT_SETTINGS.memosTimeoutMs,
    sleep:
      options.sleep ??
      ((ms: number) => new Promise<void>((r) => setTimeout(r, ms))),
  };
  const url = (path: string, params: Record<string, string>) => {
    const u = new URL(`${root}${path}`);
    u.searchParams.set('site', options.site);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return u;
  };
  return {
    last: (limit) => remarkGet(c, url(`/api/v1/last/${limit}`, {})),
    find: (pageUrl) =>
      remarkGet(
        c,
        url('/api/v1/find', { url: pageUrl, format: 'plain', sort: 'time' }),
      ),
  };
}

/**
 * Comments from a file `comments.json` (a list as Remark42 returns it) for tests
 * and the demo. The page is found by its path, the origin is ignored.
 */
export function createFixtureRemarkSource(folder: string): RemarkSource {
  async function all() {
    const raw: unknown = JSON.parse(
      await readFile(path.join(folder, 'comments.json'), 'utf8'),
    );
    return parseComments(raw);
  }
  const pathOf = (url: string): string =>
    new URL(url, 'http://fixture.invalid').pathname;
  return {
    last: async (limit) => {
      const r = await all();
      return { ...r, comments: r.comments.slice(-limit) };
    },
    find: async (url) => {
      const r = await all();
      const wanted = pathOf(url);
      return {
        ...r,
        comments: r.comments.filter((c) => pathOf(c.locator.url) === wanted),
      };
    },
  };
}
