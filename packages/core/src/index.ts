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
export {
  ALLOWED_IMAGE_HOSTS,
  EMBED_RULES,
  isAllowedImageUrl,
  matchEmbed,
} from './policy.ts';
export type { EmbedMatch, EmbedRule } from './policy.ts';
export { createLocalImageResolver, processImage } from './media.ts';
export type {
  ImageVariant,
  LocalImageResolver,
  ProcessedImage,
} from './media.ts';
export { renderMarkdown } from './render.ts';
export type {
  ImageResolveResult,
  RenderOptions,
  RenderResult,
  ResolvedImage,
} from './render.ts';
export {
  ALLOWED_FILES,
  allowedFileFor,
  altTextFromFilename,
  contentTypeForMediaFile,
  safeFileName,
  sniffMatches,
} from './media-files.ts';
export type { AllowedFile, FileKind, Sniff } from './media-files.ts';
export {
  MemosError,
  buildMemoEntries,
  createFixtureMemosSource,
  createHttpMemosSource,
} from './memos.ts';
export type {
  BuildMemosOptions,
  FetchedAttachment,
  HttpMemosOptions,
  MemoAttachmentRaw,
  MemoEntry,
  MemoRaw,
  MemosSource,
} from './memos.ts';
export { toResolvedImage } from './media.ts';
export { plainExcerpt } from './excerpt.ts';
export {
  PAGE_SIZE,
  buildFeed,
  filterKind,
  groupByTag,
  pagePath,
  paginate,
} from './feed.ts';
export type { FeedItem, FeedKind, Page, TagGroup } from './feed.ts';
