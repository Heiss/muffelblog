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

/** GETs JSON from webmention.io with the token; errors never name the token. */
async function getJson(
  options: ReceiveOptions,
  pathname: string,
  params: Record<string, string>,
): Promise<unknown> {
  const url = new URL(`${options.apiUrl.replace(/\/+$/, '')}${pathname}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  let res: Response;
  try {
    res = await (options.fetch ?? globalThis.fetch)(url.href, {
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

async function fetchMentions(
  options: ReceiveOptions,
  sinceId: number,
): Promise<ReceivedMention[]> {
  const all: ReceivedMention[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const params: Record<string, string> = {
      token: options.token,
      'per-page': String(PER_PAGE),
      page: String(page),
      'sort-dir': 'up',
    };
    if (sinceId > 0) params.since_id = String(sinceId);
    const list = parseMentions(
      await getJson(options, '/api/mentions.jf2', params),
    );
    all.push(...list);
    if (list.length < PER_PAGE) break;
  }
  return all;
}

/** The saved state, or the one rebuilt from the comments of Remark42. */
async function startState(
  options: ReceiveOptions,
  stateFile: string,
): Promise<ReceiveState> {
  const saved = await loadReceiveState(stateFile);
  if (saved) return saved;
  const state = recoverFromComments(await options.admin.list(1000));
  options.log(
    `webmentions received: no state yet, ${Object.keys(state.posted).length} existing mention comment(s) found in Remark42`,
  );
  return state;
}

/** Posts the new mentions and removes the deleted ones; saves after each step. */
async function apply(
  options: ReceiveOptions,
  state: ReceiveState,
  plan: ReturnType<typeof planReceive>,
  save: () => Promise<void>,
): Promise<void> {
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
    options.log(`webmention received: ${item.mention.source} -> ${item.page}`);
    await save();
  }
  for (const item of plan.remove) {
    await options.admin.deleteComment(item.commentId, item.page);
    delete state.posted[item.key];
    options.log(`webmention removed: ${item.key}`);
    await save();
  }
}

/** Reads received mentions from webmention.io and writes them into Remark42 as comments. */
export function createReceiveRunner(options: ReceiveOptions) {
  const stateFile = path.join(options.stateDir, 'webmentions-received.json');
  return {
    /** One run: read, post, remove, save. A failure is thrown to the caller, who logs it. */
    async run(): Promise<{ posted: number; removed: number }> {
      const state = await startState(options, stateFile);
      const mentions = await fetchMentions(options, state.sinceId);
      const deleted = parseDeleted(
        await getJson(options, '/api/deleted', {
          token: options.token,
          'per-page': String(PER_PAGE),
        }),
      );
      const plan = planReceive(state, mentions, deleted, options.siteUrl);
      const save = () =>
        writeAtomic(stateFile, JSON.stringify(state, null, 2) + '\n');
      await apply(options, state, plan, save);
      state.sinceId = plan.sinceId;
      await save();
      return { posted: plan.post.length, removed: plan.remove.length };
    },
  };
}
