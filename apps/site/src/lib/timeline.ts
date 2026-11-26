import { berlinDay, tagSlug } from '@muffelblog/core';
import type { FeedRow, FeedSort, MemoEntry, TagGroup } from '@muffelblog/core';

/** The rows of one day of the timeline (layout W24). */
export interface DayGroup {
  /** `YYYY-MM-DD` in Berlin time. */
  day: string;
  /** The date of the first row, for the heading of the day. */
  date: Date;
  rows: FeedRow[];
}

/**
 * Consecutive rows of the same day (by the date the list is sorted by) form a
 * group. The list is sorted, so each day is one group.
 */
export function groupByDay(
  rows: readonly FeedRow[],
  sort: FeedSort = 'created',
): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const row of rows) {
    const date = row[sort];
    const day = berlinDay(date);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.rows.push(row);
    else groups.push({ day, date, rows: [row] });
  }
  return groups;
}

function slugsOf(tags: readonly string[]): Set<string> {
  return new Set(
    tags.map((t) => tagSlug(t)).filter((s): s is string => Boolean(s)),
  );
}

export interface Related {
  /** The newest memos that share a tag, at most `limit`. */
  memos: MemoEntry[];
  /** How many memos share a tag in total. */
  total: number;
  /** The tags of the memo as addresses with their number of memos. */
  tags: { slug: string; name: string; count: number }[];
}

function sharesTag(memo: MemoEntry, slugs: Set<string>): boolean {
  return [...slugsOf(memo.tags)].some((s) => slugs.has(s));
}

/**
 * Memos with at least one tag of this memo, all tags mixed, newest first
 * (memo page, O40). The memo itself is not part of it.
 */
export function relatedMemos(
  memo: MemoEntry,
  memos: readonly MemoEntry[],
  limit = 4,
): Related {
  const own = slugsOf(memo.tags);
  const others = memos
    .filter((m) => m.uid !== memo.uid && sharesTag(m, own))
    .sort((a, b) => b.created.getTime() - a.created.getTime());
  const tags = [...own].map((slug) => ({
    slug,
    name: memo.tags.find((t) => tagSlug(t) === slug) ?? slug,
    count: memos.filter((m) => slugsOf(m.tags).has(slug)).length,
  }));
  return { memos: others.slice(0, limit), total: others.length, tags };
}

export interface CloudTag {
  slug: string;
  name: string;
  count: number;
  /** Size step from 1 (rare) to 6 (most frequent), logarithmic. */
  step: number;
}

/**
 * The tag cloud (U4): every tag with a size step by its count on a logarithmic
 * scale, so the tags used once stay readable next to the large ones.
 */
export function tagCloud(groups: readonly TagGroup[]): CloudTag[] {
  const max = Math.max(1, ...groups.map((g) => g.count));
  return groups.map((g) => ({
    slug: g.slug,
    name: g.names[0] ?? g.slug,
    count: g.count,
    step:
      max === 1 ? 1 : 1 + Math.round((5 * Math.log(g.count)) / Math.log(max)),
  }));
}
