import { recentComments } from '@muffelblog/core';
import type { RecentComment } from '@muffelblog/core';
import { allComments } from './comments-static';
import { getFeed } from './feed';

/** How many comments one page of "new comments" shows. */
export const RECENT_PAGE_SIZE = 50;

/** The path of a comment's address (a full address or a path, as in test fixtures). */
function pathOf(address: string): string {
  try {
    return new URL(address, 'http://comments.invalid').pathname;
  } catch {
    return address;
  }
}

let recent: Promise<RecentComment[] | undefined> | undefined;

/**
 * All comments of the site as one list, newest first, or `undefined` when there
 * is no source of comments. Comments on pages that are not published are left out.
 */
export function getRecentComments(): Promise<RecentComment[] | undefined> {
  recent ??= (async () => {
    const comments = await allComments();
    if (!comments) return undefined;
    const pages = new Map(
      (await getFeed()).map((item) => [item.url, item.title]),
    );
    return recentComments(comments, (address) => {
      const url = pathOf(address);
      const title = pages.get(url);
      return title === undefined ? undefined : { url, title };
    });
  })();
  return recent;
}
