import path from 'node:path';
import {
  createFixtureRemarkSource,
  forPage,
  createRemarkSource,
  readSettings,
  toTree,
} from '@muffelblog/core';
import type {
  CommentNode,
  RemarkComment,
  RemarkSource,
} from '@muffelblog/core';
import { staticCommentsConfig } from './comments';
import { canonicalUrl, siteUrl } from './feed';
import { findRepoRoot } from './content';

let source: RemarkSource | undefined | null;
const cache = new Map<string, Promise<CommentNode[]>>();

function getSource(): RemarkSource | undefined {
  if (source !== null && source !== undefined) return source;
  if (source === undefined) {
    const config = staticCommentsConfig();
    if (!config) {
      source = null;
      return undefined;
    }
    source =
      config.kind === 'fixtures'
        ? createFixtureRemarkSource(
            path.join(
              findRepoRoot(process.cwd()),
              'packages',
              'core',
              'fixtures',
              config.folder,
            ),
          )
        : createRemarkSource({
            baseUrl: config.baseUrl,
            site: config.siteId,
            timeoutMs: readSettings().memosTimeoutMs,
          });
  }
  return source ?? undefined;
}

/** What `last` can return at most; a full answer may be cut off. */
const LAST_LIMIT = 1000;
let everything:
  Promise<{ comments: RemarkComment[]; complete: boolean }> | undefined;

/**
 * One request for all comments of the site per build (Remark42 limits the
 * request rate, so one request per page does not work). If the answer is as
 * long as the limit it may be incomplete, then single pages are asked for.
 */
function loadEverything(src: RemarkSource) {
  everything ??= src.last(LAST_LIMIT).then(({ comments, warnings }) => {
    for (const w of warnings) console.warn(`[comments] ${w}`);
    return { comments, complete: comments.length < LAST_LIMIT };
  });
  return everything;
}

/** All comments of the site (the latest 1000), or `undefined` without a source. */
export async function allComments(): Promise<RemarkComment[] | undefined> {
  const src = getSource();
  return src ? (await loadEverything(src)).comments : undefined;
}

/**
 * The comments of a page for the static copy, or `undefined` if there is no
 * source. The key is the canonical address (the one the widget uses); without a
 * domain only fixtures work, which are found by path. If Remark42 cannot be
 * read, this throws and the build stops, so the last good version stays online.
 */
export async function commentsFor(
  pathname: string,
): Promise<CommentNode[] | undefined> {
  const src = getSource();
  if (!src) return undefined;
  const key = canonicalUrl(siteUrl(), pathname) ?? pathname;
  let found = cache.get(key);
  if (!found) {
    found = (async () => {
      const all = await loadEverything(src);
      if (all.complete) return toTree(forPage(all.comments, key));
      const { comments, warnings } = await src.find(key);
      for (const w of warnings) console.warn(`[comments] ${key}: ${w}`);
      return toTree(comments);
    })();
    cache.set(key, found);
  }
  return found;
}
