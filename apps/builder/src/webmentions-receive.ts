import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  emptyReceiveState,
  mentionKey,
  mentionText,
  parseDeleted,
  parseMentions,
  planReceive,
  type ReceiveState,
  type ReceivedMention,
} from '@muffelblog/core';
import type { AdminComment } from './remark-admin.ts';
import { writeAtomic } from './serve.ts';

/** The part of the Remark42 administrator client the receiver needs. */
export interface ReceiveAdmin {
  list(limit: number): Promise<AdminComment[]>;
  postComment(text: string, pageUrl: string): Promise<string>;
  deleteComment(id: string, pageUrl: string): Promise<void>;
}

export interface ReceiveOptions {
  stateDir: string;
  siteUrl: string;
  /** `WEBMENTION_IO_URL`, `https://webmention.io` or the stand-in of the tests. */
  apiUrl: string;
  /** `WEBMENTION_IO_TOKEN`. Never printed. */
  token: string;
  lang: 'en' | 'de';
  admin: ReceiveAdmin;
  log: (line: string) => void;
  timeoutMs: number;
  maxBytes: number;
  fetch?: typeof fetch;
}

const PER_PAGE = 100;
const MAX_PAGES = 50;

/** Loads the state; `undefined` when there is none (then the comments of Remark42 are read). */
export async function loadReceiveState(
  file: string,
): Promise<ReceiveState | undefined> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
  try {
    const parsed = JSON.parse(text) as ReceiveState;
    if (
      parsed?.version === 1 &&
      typeof parsed.sinceId === 'number' &&
      typeof parsed.posted === 'object'
    )
      return parsed;
  } catch {
    // falls through
  }
  return undefined;
}

/**
 * Rebuilds the state from Remark42 when the state file is lost (O3): every
 * comment of the administrator that links to a source counts as posted, so no
 * mention is posted twice.
 */
export function recoverFromComments(
  comments: readonly AdminComment[],
): ReceiveState {
  const state = emptyReceiveState();
  for (const c of comments) {
    const user = c.user as AdminComment['user'] & { admin?: boolean };
    if (!(user.admin === true || user.id === 'admin')) continue;
    for (const m of c.text.matchAll(/href="([^"]+)"/g)) {
      const source = (m[1] ?? '')
        .replace(/&amp;/g, '&')
        .replace(/%28/g, '(')
        .replace(/%29/g, ')');
      state.posted[mentionKey({ source, target: c.locator.url })] = {
        commentId: c.id,
        page: c.locator.url,
        wmId: 0,
      };
    }
  }
  return state;
}

/** Reads received mentions from webmention.io and writes them into Remark42 as comments. */
export function createReceiveRunner(options: ReceiveOptions) {
  const stateFile = path.join(options.stateDir, 'webmentions-received.json');
  const doFetch = options.fetch ?? globalThis.fetch;
  const api = options.apiUrl.replace(/\/+$/, '');

  async function getJson(
    pathname: string,
    params: Record<string, string>,
  ): Promise<unknown> {
    const url = new URL(`${api}${pathname}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    let res: Response;
    try {
      res = await doFetch(url.href, {
        // The token goes in the header, so it never lands in a log of a proxy.
        headers: {
          Authorization: `Bearer ${options.token}`,
          Accept: 'application/json',
        },
        redirect: 'error',
        signal: AbortSignal.timeout(options.timeoutMs),
      });
    } catch (error) {
      throw new Error(
        `webmention.io is unreachable (${error instanceof Error ? error.message : String(error)})`,
        { cause: error },
      );
    }
    if (!res.ok)
      throw new Error(`webmention.io answered ${res.status} for ${pathname}`);
    const text = await res.text();
    if (text.length > options.maxBytes)
      throw new Error(
        `webmention.io answered with too much data for ${pathname}`,
      );
    return JSON.parse(text) as unknown;
  }

  async function fetchMentions(sinceId: number): Promise<ReceivedMention[]> {
    const all: ReceivedMention[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const params: Record<string, string> = {
        token: options.token,
        'per-page': String(PER_PAGE),
        page: String(page),
        'sort-dir': 'up',
      };
      if (sinceId > 0) params.since_id = String(sinceId);
      const list = parseMentions(await getJson('/api/mentions.jf2', params));
      all.push(...list);
      if (list.length < PER_PAGE) break;
    }
    return all;
  }

  return {
    /** One run: read, post, remove, save. A failure is thrown to the caller, who logs it. */
    async run(): Promise<{ posted: number; removed: number }> {
      let state = await loadReceiveState(stateFile);
      if (!state) {
        state = recoverFromComments(await options.admin.list(1000));
        const known = Object.keys(state.posted).length;
        options.log(
          `webmentions received: no state yet, ${known} existing mention comment(s) found in Remark42`,
        );
      }
      const mentions = await fetchMentions(state.sinceId);
      const deleted = parseDeleted(
        await getJson('/api/deleted', {
          token: options.token,
          'per-page': String(PER_PAGE),
        }),
      );
      const plan = planReceive(state, mentions, deleted, options.siteUrl);
      const save = () =>
        writeAtomic(stateFile, JSON.stringify(state, null, 2) + '\n');
      let posted = 0;
      for (const item of plan.post) {
        const commentId = await options.admin.postComment(
          mentionText(item.mention, options.lang),
          item.page,
        );
        state.posted[item.key] = {
          commentId,
          page: item.page,
          wmId: item.mention.id,
        };
        posted++;
        options.log(
          `webmention received: ${item.mention.source} -> ${item.page}`,
        );
        await save();
      }
      let removed = 0;
      for (const item of plan.remove) {
        await options.admin.deleteComment(item.commentId, item.page);
        delete state.posted[item.key];
        removed++;
        options.log(`webmention removed: ${item.key}`);
        await save();
      }
      state.sinceId = plan.sinceId;
      await save();
      return { posted, removed };
    },
  };
}
