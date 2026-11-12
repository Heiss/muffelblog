import { tagSlug } from '@muffelblog/core';
import type { FeedItem } from '@muffelblog/core';
import type { LiveEntry, LiveList } from '../scripts/live-logic';

/** How many of the newest entries `/entries.json` lists. */
export const LIVE_LIMIT = 20;

/**
 * The public list for the "N new entries" banner: id, kind, date and tag
 * addresses of the newest entries, newest first. No titles and no texts.
 */
export function liveEntries(
  items: readonly FeedItem[],
  limit: number = LIVE_LIMIT,
): LiveList {
  const entries: LiveEntry[] = items.slice(0, limit).map((item) => ({
    id: item.id,
    kind: item.kind,
    date: item.created.toISOString(),
    tags: item.tags
      .map((tag) => tagSlug(tag))
      .filter((slug): slug is string => slug !== null && slug !== ''),
  }));
  return { limit, entries };
}
