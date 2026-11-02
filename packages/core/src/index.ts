export const SITE_NAME = 'Muffelblog';
export const SITE_LANG = 'de';

/** Titel einer Seite: Seitenname, bei gesetztem Titel mit vorangestelltem Titel. */
export function pageTitle(title?: string): string {
  const trimmed = title?.trim();
  return trimmed ? `${trimmed} – ${SITE_NAME}` : SITE_NAME;
}

export {
  assignUniqueSlugs,
  isIgnoredPath,
  loadArticles,
  parseArticle,
} from './articles.ts';
export type { Article, ParseResult } from './articles.ts';
export { berlinLocalToInstant, parseDate } from './date.ts';
export { splitFrontmatter } from './frontmatter.ts';
export { normalizeTag, tagSlug, toSlug } from './slug.ts';
