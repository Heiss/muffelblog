/**
 * Receiving webmentions through webmention.io (W14): reading its API, deciding
 * what to post into Remark42 and the text of such a comment. The network and
 * Remark42 live in the builder; this part is pure.
 */

export interface ReceivedMention {
  /** `wm-id` of webmention.io. */
  id: number;
  source: string;
  target: string;
  /** `wm-property`: mention-of, in-reply-to, like-of, repost-of, bookmark-of, rsvp. */
  property: string;
  authorName?: string;
}

export interface DeletedMention {
  id: number;
  source: string;
  target: string;
}

export interface PostedMention {
  commentId: string;
  /** The page (canonical address) the comment belongs to. */
  page: string;
  wmId: number;
}

export interface ReceiveState {
  version: 1;
  /** Highest `wm-id` that was read. */
  sinceId: number;
  /** Posted comments by `source -> page`. */
  posted: Record<string, PostedMention>;
}

export function emptyReceiveState(): ReceiveState {
  return { version: 1, sinceId: 0, posted: {} };
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function httpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

/** Reads a jf2 feed of `/api/mentions.jf2`. Broken entries are skipped. */
export function parseMentions(json: unknown): ReceivedMention[] {
  if (!isObject(json) || !Array.isArray(json.children)) {
    throw new Error('webmention.io did not answer with a feed (jf2)');
  }
  const out: ReceivedMention[] = [];
  for (const child of json.children) {
    if (!isObject(child)) continue;
    const id = child['wm-id'];
    const source = httpUrl(child['wm-source']);
    const target = httpUrl(child['wm-target']);
    if (typeof id !== 'number' || !Number.isInteger(id) || !source || !target)
      continue;
    if (child['wm-private'] === true) continue;
    const property =
      typeof child['wm-property'] === 'string'
        ? child['wm-property']
        : 'mention-of';
    const author = isObject(child.author) ? child.author : undefined;
    const name =
      typeof author?.name === 'string' && author.name.trim() !== ''
        ? author.name.trim().slice(0, 100)
        : undefined;
    out.push({
      id,
      source,
      target,
      property,
      ...(name ? { authorName: name } : {}),
    });
  }
  return out;
}

/** Reads the list of `/api/deleted`. */
export function parseDeleted(json: unknown): DeletedMention[] {
  const list = Array.isArray(json)
    ? json
    : isObject(json) && Array.isArray(json.children)
      ? json.children
      : [];
  const out: DeletedMention[] = [];
  for (const item of list) {
    if (!isObject(item)) continue;
    const id = item['wm-id'];
    const source = httpUrl(item['wm-source']);
    const target = httpUrl(item['wm-target']);
    if (typeof id === 'number' && source && target)
      out.push({ id, source, target });
  }
  return out;
}

/**
 * The page of the own site a mention points to: posts, memos and terms only,
 * as canonical address with a trailing slash. Anything else: undefined.
 */
export function targetPage(
  target: string,
  siteUrl: string,
): string | undefined {
  let url: URL;
  let site: URL;
  try {
    url = new URL(target);
    site = new URL(siteUrl);
  } catch {
    return undefined;
  }
  if (url.origin !== site.origin) return undefined;
  const m = url.pathname.match(/^\/([pmg])\/([^/]+)\/?$/);
  return m ? `${site.origin}/${m[1]}/${m[2]}/` : undefined;
}

export function mentionKey(m: { source: string; target: string }): string {
  return `${m.source} -> ${m.target}`;
}

const KINDS: Record<'en' | 'de', Record<string, string>> = {
  en: {
    'mention-of': 'Mention',
    'in-reply-to': 'Reply',
    'like-of': 'Like',
    'repost-of': 'Repost',
    'bookmark-of': 'Bookmark',
    rsvp: 'RSVP',
  },
  de: {
    'mention-of': 'Erwähnung',
    'in-reply-to': 'Antwort',
    'like-of': 'Like',
    'repost-of': 'Repost',
    'bookmark-of': 'Lesezeichen',
    rsvp: 'Zusage',
  },
};
const FROM = { en: 'from', de: 'von' } as const;

/** Removes HTML and escapes Markdown, so a foreign name stays plain text. */
function plain(text: string): string {
  return text
    .replace(/[<>]/g, '')
    .replace(/[\\`*_[\]()#!|~{}]/g, (c) => `\\${c}`)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The text of the comment for a mention: kind, author (or host of the source)
 * and the link. Foreign text is never taken over as Markdown or HTML.
 */
export function mentionText(m: ReceivedMention, lang: 'en' | 'de'): string {
  const kinds = KINDS[lang];
  const kind = kinds[m.property] ?? kinds['mention-of'];
  const url = new URL(m.source);
  const link = url.href.replace(/\(/g, '%28').replace(/\)/g, '%29');
  const who = plain(m.authorName ?? url.hostname) || url.hostname;
  return `${kind} ${FROM[lang]} ${who}: [${link}](${link})`;
}

export interface ReceivePlan {
  post: { key: string; page: string; mention: ReceivedMention }[];
  remove: { key: string; commentId: string; page: string }[];
  /** Mentions of addresses that are no post, memo or term. */
  skipped: number;
  sinceId: number;
}

/** Decides what to post and what to remove. Pure: the caller does the work and saves the state. */
export function planReceive(
  state: ReceiveState,
  mentions: readonly ReceivedMention[],
  deleted: readonly DeletedMention[],
  siteUrl: string,
): ReceivePlan {
  const plan: ReceivePlan = {
    post: [],
    remove: [],
    skipped: 0,
    sinceId: state.sinceId,
  };
  const seen = new Set<string>();
  for (const m of mentions) {
    plan.sinceId = Math.max(plan.sinceId, m.id);
    const page = targetPage(m.target, siteUrl);
    if (!page) {
      plan.skipped++;
      continue;
    }
    const key = mentionKey({ source: m.source, target: page });
    if (state.posted[key] || seen.has(key)) continue;
    seen.add(key);
    plan.post.push({ key, page, mention: m });
  }
  for (const d of deleted) {
    const page = targetPage(d.target, siteUrl) ?? d.target;
    const key = mentionKey({ source: d.source, target: page });
    const posted = state.posted[key];
    if (posted)
      plan.remove.push({ key, commentId: posted.commentId, page: posted.page });
  }
  return plan;
}
