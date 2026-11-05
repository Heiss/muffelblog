/** One entry of `/entries.json`: just enough to count what is new. */
export interface LiveEntry {
  id: string;
  kind: 'post' | 'memo' | 'glossary';
  /** ISO 8601 */
  date: string;
  /** Tag addresses (slugs), as in `/tag/<slug>/`. */
  tags: string[];
}

export interface LiveList {
  /** How many entries the list holds at most (the newest ones). */
  limit: number;
  entries: LiveEntry[];
}

const KINDS = new Set(['post', 'memo', 'glossary']);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isDateText = (v: unknown): v is string =>
  typeof v === 'string' && !Number.isNaN(Date.parse(v));

const isTextList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((t) => typeof t === 'string');

/** One entry of the list, or null when it is not what the site writes. */
function toEntry(raw: unknown): LiveEntry | null {
  if (!isRecord(raw)) return null;
  const { id, kind, date, tags } = raw;
  if (typeof id !== 'string' || typeof kind !== 'string' || !KINDS.has(kind))
    return null;
  if (!isDateText(date) || !isTextList(tags)) return null;
  return { id, kind: kind as LiveEntry['kind'], date, tags };
}

/** Reads `/entries.json`. Anything that is not what the site writes gives null. */
export function parseLive(value: unknown): LiveList | null {
  if (!isRecord(value)) return null;
  const { limit, entries } = value;
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1)
    return null;
  if (!Array.isArray(entries)) return null;
  const out = entries.map(toEntry);
  return out.every((e): e is LiveEntry => e !== null)
    ? { limit, entries: out }
    : null;
}

export interface Scope {
  kind: 'all' | LiveEntry['kind'];
  /** Set on a tag page: only entries with this tag count. */
  tag?: string;
}

const SERIES: Record<string, Scope['kind']> = {
  '/': 'all',
  '/posts/': 'post',
  '/memos/': 'memo',
  '/terms/': 'glossary',
};

/**
 * Which entries belong to the page, or null if no banner belongs there: only
 * the first block of a series or of a tag page shows the newest entries.
 */
export function scopeFor(path: string): Scope | null {
  const series = SERIES[path];
  if (series !== undefined) return { kind: series };
  const tag = /^\/tag\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/.exec(path);
  if (tag) return { kind: 'all', tag: tag[1] };
  return null;
}

/**
 * How many entries are new: newer than the newest one that is loaded, not in
 * the list yet, and in the scope of the page. `more` is true when the whole
 * window of the list is new, so there may be even more beyond it.
 */
export function countNew(
  entries: readonly LiveEntry[],
  loaded: ReadonlyArray<{ id: string; date: string }>,
  scope: Scope,
  limit: number,
): { count: number; more: boolean } {
  const newest = loaded.reduce(
    (max, l) => Math.max(max, Date.parse(l.date)),
    Number.NEGATIVE_INFINITY,
  );
  const have = new Set(loaded.map((l) => l.id));
  const isNew = (entry: LiveEntry) =>
    Date.parse(entry.date) > newest && !have.has(entry.id);
  const inScope = (entry: LiveEntry) =>
    (scope.kind === 'all' || entry.kind === scope.kind) &&
    (scope.tag === undefined || entry.tags.includes(scope.tag));
  const count = entries.filter((e) => inScope(e) && isNew(e)).length;
  const oldest = entries[entries.length - 1];
  const more = entries.length >= limit && oldest !== undefined && isNew(oldest);
  return { count, more: count > 0 && more };
}

export interface LiveDeps {
  /** The id of the build that is online (`/build.json`), null if it cannot be read. */
  getBuild: () => Promise<string | null>;
  /** `/entries.json`, null if it cannot be read. */
  getEntries: () => Promise<LiveList | null>;
  /** The entries that are in the list now. */
  loaded: () => ReadonlyArray<{ id: string; date: string }>;
  /** Null: no banner on this page. */
  scope: () => Scope | null;
  show: (news: { count: number; more: boolean }) => void;
}

/**
 * One poll: remember the build at the first look. When the build changes, read
 * the list of entries once and count. A build without new entries (a comment
 * changed) shows nothing. If the list cannot be read, the next poll tries again.
 */
export function createLive(deps: LiveDeps) {
  let base: string | undefined;
  return {
    async poll(): Promise<void> {
      if (deps.scope() === null) return;
      const build = await deps.getBuild();
      if (build === null) return;
      if (base === undefined) {
        base = build;
        return;
      }
      if (build === base) return;
      const list = await deps.getEntries();
      if (list === null) return;
      base = build;
      const scope = deps.scope();
      if (scope === null) return;
      const news = countNew(list.entries, deps.loaded(), scope, list.limit);
      if (news.count > 0) deps.show(news);
    },
  };
}
