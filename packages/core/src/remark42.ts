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
}

/**
 * Reads comments through the public API of Remark42; no login is needed. Any
 * error (server down, wrong answer) is thrown, never turned into "no comments",
 * so the build stops and the last good version stays online.
 */
export function createRemarkSource(options: RemarkOptions): RemarkSource {
  let base: URL;
  try {
    base = new URL(options.baseUrl);
  } catch {
    throw new Error(
      `REMARK_INTERNAL_URL is not an address: ${options.baseUrl}`,
    );
  }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') {
    throw new Error(
      `REMARK_INTERNAL_URL must start with http:// or https://: ${options.baseUrl}`,
    );
  }
  const root = `${base.origin}${base.pathname.replace(/\/+$/, '')}`;
  const doFetch = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_SETTINGS.memosTimeoutMs;

  async function get(url: URL) {
    let res: Response;
    try {
      res = await doFetch(url.href, {
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: 'application/json' },
      });
    } catch (error) {
      throw new Error(
        `Remark42 is unreachable (${error instanceof Error ? error.message : String(error)})`,
        { cause: error },
      );
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

  return {
    last(limit) {
      const url = new URL(`${root}/api/v1/last/${limit}`);
      url.searchParams.set('site', options.site);
      return get(url);
    },
    find(pageUrl) {
      const url = new URL(`${root}/api/v1/find`);
      url.searchParams.set('site', options.site);
      url.searchParams.set('url', pageUrl);
      url.searchParams.set('format', 'plain');
      url.searchParams.set('sort', 'time');
      return get(url);
    },
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
