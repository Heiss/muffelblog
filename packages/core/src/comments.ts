import { createHash } from 'node:crypto';
import { renderMarkdown } from './render.ts';

/** A comment as Remark42 returns it (only the fields we use). */
export interface RemarkComment {
  id: string;
  /** Id of the comment this one answers. */
  pid?: string;
  /** HTML, already cleaned by Remark42. */
  text: string;
  user: { name: string };
  time: string;
  delete?: boolean;
  locator: { url: string };
}

export interface CommentNode {
  id: string;
  /** Plain text, to be escaped on output. */
  author: string;
  /** ISO time. */
  time: string;
  /** Sanitized HTML; empty for a deleted comment that only keeps its replies. */
  html: string;
  deleted: boolean;
  replies: CommentNode[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function toComment(raw: unknown): RemarkComment | string {
  if (!isObject(raw)) return 'not an object';
  const { id, pid, text, user, time, locator } = raw;
  if (typeof id !== 'string' || id === '') return 'no id';
  if (typeof text !== 'string') return `comment ${id}: no text`;
  if (!isObject(user) || typeof user.name !== 'string')
    return `comment ${id}: no author`;
  if (typeof time !== 'string' || Number.isNaN(Date.parse(time))) {
    return `comment ${id}: invalid time`;
  }
  const url =
    isObject(locator) && typeof locator.url === 'string' ? locator.url : '';
  return {
    id,
    ...(typeof pid === 'string' && pid !== '' ? { pid } : {}),
    text,
    user: { name: user.name },
    time,
    ...(raw.delete === true ? { delete: true } : {}),
    locator: { url },
  };
}

/**
 * Reads the answer of Remark42 (a list, or an object with `comments`). A broken
 * entry is skipped with a warning; an answer that is no list of comments at all
 * is an error, so a broken server never counts as "no comments".
 */
export function parseComments(raw: unknown): {
  comments: RemarkComment[];
  warnings: string[];
} {
  let list: unknown;
  if (Array.isArray(raw)) list = raw;
  else if (isObject(raw) && 'comments' in raw) list = raw.comments ?? [];
  else throw new Error('Unexpected answer of Remark42 (no comments)');
  if (!Array.isArray(list))
    throw new Error('Unexpected answer of Remark42 (comments is not a list)');

  const comments: RemarkComment[] = [];
  const warnings: string[] = [];
  for (const entry of list) {
    const parsed = toComment(entry);
    if (typeof parsed === 'string') warnings.push(`Comment skipped: ${parsed}`);
    else comments.push(parsed);
  }
  return { comments, warnings };
}

/** The text of a comment through the same sanitizer as all other content; no foreign images. */
async function renderComment(html: string): Promise<string> {
  const { html: out } = await renderMarkdown(html, {
    articlePath: 'comment',
    remoteContent: 'none',
    resolveImage: async () => ({
      ok: false,
      code: 'not-found',
      reason: 'no images in comments',
    }),
  });
  return out;
}

/** Builds the tree: oldest first, replies below their parent. Nothing is lost, loops are broken. */
export async function toTree(
  comments: readonly RemarkComment[],
): Promise<CommentNode[]> {
  const byId = new Map(comments.map((c) => [c.id, c]));
  const byTime = (a: RemarkComment, b: RemarkComment): number =>
    Date.parse(a.time) - Date.parse(b.time) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  const parentOf = (c: RemarkComment): string | undefined =>
    c.pid && byId.has(c.pid) ? c.pid : undefined;

  // Members of a loop of parents (A answers B, B answers A): the oldest member
  // of each loop becomes a root, so nothing is lost and nothing loops forever.
  const inLoop = new Set<string>();
  for (const start of comments) {
    const order = new Map<string, number>();
    let cur: string | undefined = start.id;
    while (cur !== undefined && !order.has(cur)) {
      order.set(cur, order.size);
      const node: RemarkComment | undefined = byId.get(cur);
      cur = node ? parentOf(node) : undefined;
    }
    if (cur !== undefined) {
      const from = order.get(cur) ?? 0;
      [...order.keys()].slice(from).forEach((id) => inLoop.add(id));
    }
  }
  const loopRoots = new Set<string>();
  const handled = new Set<string>();
  for (const c of [...comments].filter((x) => inLoop.has(x.id)).sort(byTime)) {
    if (handled.has(c.id)) continue;
    loopRoots.add(c.id);
    let cur: string | undefined = c.id;
    while (cur !== undefined && !handled.has(cur)) {
      handled.add(cur);
      const node: RemarkComment | undefined = byId.get(cur);
      cur = node ? parentOf(node) : undefined;
    }
  }

  const children = new Map<string, RemarkComment[]>();
  const roots: RemarkComment[] = [];
  for (const c of [...comments].sort(byTime)) {
    const parent = parentOf(c);
    if (parent === undefined || loopRoots.has(c.id)) {
      roots.push(c);
    } else {
      const list = children.get(parent) ?? [];
      list.push(c);
      children.set(parent, list);
    }
  }

  const build = async (
    c: RemarkComment,
    path: Set<string>,
  ): Promise<CommentNode | undefined> => {
    const replies: CommentNode[] = [];
    const next = new Set(path).add(c.id);
    for (const r of children.get(c.id) ?? []) {
      if (next.has(r.id)) continue;
      const node = await build(r, next);
      if (node) replies.push(node);
    }
    if (c.delete && replies.length === 0) return undefined;
    return {
      id: c.id,
      author: c.user.name,
      time: new Date(c.time).toISOString(),
      html: c.delete ? '' : await renderComment(c.text),
      deleted: c.delete === true,
      replies,
    };
  };

  const result: CommentNode[] = [];
  for (const root of roots) {
    const node = await build(root, new Set());
    if (node) result.push(node);
  }
  return result;
}

/** Changes with every new, edited or deleted comment; independent of the order. */
export function commentsFingerprint(
  comments: readonly RemarkComment[],
): string {
  const lines = comments
    .map((c) =>
      JSON.stringify([
        c.id,
        c.pid ?? '',
        c.time,
        c.text,
        c.user.name,
        c.delete === true,
        c.locator.url,
      ]),
    )
    .sort();
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

function normalizeAddress(address: string): string {
  try {
    return new URL(address).href;
  } catch {
    return address;
  }
}

function pathOf(address: string): string | undefined {
  try {
    return new URL(address, 'http://fixture.invalid').pathname;
  } catch {
    return undefined;
  }
}

/**
 * The comments of one page out of a list for the whole site. The page is found
 * by its address (written in any equivalent form); a key that is only a path
 * (test fixtures) is compared by path.
 */
export function forPage(
  comments: readonly RemarkComment[],
  key: string,
): RemarkComment[] {
  const wanted = normalizeAddress(key);
  const pathOnly = key.startsWith('/');
  return comments.filter((c) =>
    pathOnly
      ? pathOf(c.locator.url) === pathOf(key)
      : normalizeAddress(c.locator.url) === wanted,
  );
}
