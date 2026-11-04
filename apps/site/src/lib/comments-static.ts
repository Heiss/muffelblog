import path from 'node:path';
import {
  createFixtureRemarkSource,
  createRemarkSource,
  readSettings,
  toTree,
} from '@muffelblog/core';
import type { CommentNode, RemarkSource } from '@muffelblog/core';
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
    found = src.find(key).then(async ({ comments, warnings }) => {
      for (const w of warnings) console.warn(`[comments] ${key}: ${w}`);
      return toTree(comments);
    });
    cache.set(key, found);
  }
  return found;
}
