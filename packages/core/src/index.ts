export const SITE_NAME = 'Muffelblog';

/** Title of a page: the site name, with the title in front if one is set. */
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
export { RESERVED_PAGE_SLUGS } from './articles.ts';
export type { Article, ArticleType, ParseResult } from './articles.ts';
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
export { createTermMatcher, linkGlossaryTerms } from './glossary-links.ts';
export type {
  GlossaryLinking,
  GlossaryTerm,
  TermMatcher,
} from './glossary-links.ts';
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
  memosFingerprint,
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
  buildFeed,
  differentDay,
  filterKind,
  groupByTag,
  pagePath,
  paginate,
  sortFeed,
} from './feed.ts';
export type { FeedItem, FeedKind, FeedSort, Page, TagGroup } from './feed.ts';
export {
  ConfigError,
  DEFAULT_LANG,
  DEFAULT_SETTINGS,
  LANGUAGES,
  SETTING_SPECS,
  readSettings,
} from './config.ts';
export type { Language, SettingSpec, Settings } from './config.ts';
export { groupByLetter, letterOf } from './glossary.ts';
export type { LetterGroup } from './glossary.ts';
export {
  commentsFingerprint,
  forPage,
  parseComments,
  toTree,
} from './comments.ts';
export type { CommentNode, RemarkComment } from './comments.ts';
export { createFixtureRemarkSource, createRemarkSource } from './remark42.ts';
export type { RemarkOptions, RemarkSource } from './remark42.ts';
export { NetError, isPublicAddress, safeFetch } from './webmention-net.ts';
export type {
  Resolved,
  SafeFetchInit,
  SafeFetchOptions,
  SafeResponse,
} from './webmention-net.ts';
export {
  extractEntry,
  findEndpoint,
  parseLinkHeader,
} from './webmention-extract.ts';
export type { EntryContent, FetchedPage } from './webmention-extract.ts';
export { emptyWebmentionState, runWebmentionSend } from './webmention-send.ts';
export type {
  PairState,
  SendDeps,
  SendReport,
  SourceEntry,
  WebmentionState,
} from './webmention-send.ts';
export { createHeifConverter, heifAvailable, isHeic } from './heic.ts';
export type { HeicConverter, HeicRunner } from './heic.ts';
export { buildGraph, extractLinks, linksOf } from './link-graph.ts';
export type {
  GraphEdge,
  GraphNode,
  GraphNodeKind,
  LinkGraph,
} from './link-graph.ts';
export {
  emptyReceiveState,
  mentionKey,
  mentionText,
  parseDeleted,
  parseMentions,
  planReceive,
  targetPage,
} from './webmention-receive.ts';
export type {
  DeletedMention,
  PostedMention,
  ReceivePlan,
  ReceiveState,
  ReceivedMention,
} from './webmention-receive.ts';
export { buildFileTree } from './file-tree.ts';
export type { TreeFile, TreeFolder } from './file-tree.ts';
export { hasExtras, isHttp, isPlainOrigin, tryUrl } from './url-check.ts';
